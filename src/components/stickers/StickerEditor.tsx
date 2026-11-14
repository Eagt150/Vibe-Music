import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useMutation } from "convex/react";
import { Eraser, ImagePlus, Undo2, Wand2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLocale } from "@/i18n/LocaleContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { TextField } from "@/components/ui/TextField";
import { eraseLine, floodErase } from "@/lib/stickerTools";
import {
  canvasToStickerBlob,
  composeSticker,
  loadImagePixels,
  type StickerOptions,
  type StickerShape,
} from "@/lib/composeSticker";
import { convexErrorCode } from "@/lib/convexError";
import { MAX_STICKERS } from "@/lib/stickerLimits";
import { cn } from "@/lib/cn";

const MAX_UNDO = 15;
const CHECKERBOARD =
  "repeating-conic-gradient(rgba(127,127,127,0.28) 0% 25%, transparent 0% 50%) 50% / 16px 16px";

type Tool = "wand" | "eraser";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex bg-surface-alt rounded-pill p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "px-3 py-1 rounded-pill text-sm font-bold cursor-pointer",
            value === o.value ? "bg-accent text-accent-text" : "text-text-dim hover:text-text"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StickerEditor({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const generateUploadUrl = useMutation(api.stickers.generateUploadUrl);
  const createSticker = useMutation(api.stickers.create);

  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<ImageData | null>(null);
  const undoRef = useRef<Uint8ClampedArray[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [hasImage, setHasImage] = useState(false);
  const [version, setVersion] = useState(0);
  const [tool, setTool] = useState<Tool>("wand");
  const [tolerance, setTolerance] = useState(18);
  const [brush, setBrush] = useState(14);
  const [opts, setOpts] = useState<StickerOptions>({
    shape: "free",
    text: "",
    textPosition: "bottom",
    textColor: "#ffffff",
    outline: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Redraw the working canvas and the live preview after every edit.
  useEffect(() => {
    const pixels = pixelsRef.current;
    if (!pixels) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = pixels.width;
      canvas.height = pixels.height;
      canvas.getContext("2d")!.putImageData(pixels, 0, 0);
    }
    const preview = previewRef.current;
    if (preview) {
      const ctx = preview.getContext("2d")!;
      ctx.clearRect(0, 0, preview.width, preview.height);
      const composed = composeSticker(pixels, opts);
      if (composed) ctx.drawImage(composed, 0, 0, preview.width, preview.height);
    }
  }, [version, opts, hasImage]);

  async function handleFile(files: FileList) {
    setError(null);
    try {
      pixelsRef.current = await loadImagePixels(files[0]);
      undoRef.current = [];
      setCanUndo(false);
      setHasImage(true);
      setVersion((v) => v + 1);
    } catch {
      setError(t("stickers.errorImage"));
    }
  }

  function snapshot() {
    const pixels = pixelsRef.current;
    if (!pixels) return;
    undoRef.current.push(new Uint8ClampedArray(pixels.data));
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    setCanUndo(true);
  }

  function undo() {
    const pixels = pixelsRef.current;
    const prev = undoRef.current.pop();
    if (!pixels || !prev) return;
    pixels.data.set(prev);
    setCanUndo(undoRef.current.length > 0);
    setError(null);
    setVersion((v) => v + 1);
  }

  function toPixel(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      // Brush size is in screen pixels; convert to image pixels.
      scale: canvas.width / rect.width,
    };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const pixels = pixelsRef.current;
    if (!pixels) return;
    const p = toPixel(e);
    snapshot();
    if (tool === "wand") {
      floodErase(pixels, p.x, p.y, tolerance);
    } else {
      e.currentTarget.setPointerCapture(e.pointerId);
      eraseLine(pixels, p.x, p.y, p.x, p.y, (brush / 2) * p.scale);
      lastPointRef.current = { x: p.x, y: p.y };
    }
    setVersion((v) => v + 1);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const pixels = pixelsRef.current;
    const last = lastPointRef.current;
    if (tool !== "eraser" || !pixels || !last) return;
    const p = toPixel(e);
    eraseLine(pixels, last.x, last.y, p.x, p.y, (brush / 2) * p.scale);
    lastPointRef.current = { x: p.x, y: p.y };
    // Cheap live redraw without re-composing the preview on every move.
    canvasRef.current?.getContext("2d")!.putImageData(pixels, 0, 0);
  }

  function handlePointerUp() {
    if (lastPointRef.current) {
      lastPointRef.current = null;
      setVersion((v) => v + 1);
    }
  }

  async function handleSave() {
    const pixels = pixelsRef.current;
    if (!pixels) return;
    const composed = composeSticker(pixels, opts);
    if (!composed) return setError(t("stickers.errorEmpty"));
    setSaving(true);
    setError(null);
    try {
      const blob = await canvasToStickerBlob(composed);
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await createSticker({ storageId });
      onClose();
    } catch (err) {
      setError(
        convexErrorCode(err) === "STICKER_LIMIT" ? t("stickers.limit", { max: MAX_STICKERS }) : t("stickers.errorGeneric")
      );
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof StickerOptions>(key: K, value: StickerOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }));

  return (
    <Modal onClose={onClose} wide>
      <div className="flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto -mx-1 px-1 [&>*]:flex-shrink-0">
        <div className="text-md font-extrabold">{t("stickers.editorTitle")}</div>
        <HiddenFileInput ref={fileRef} accept="image/png,image/jpeg,image/webp,image/gif" onFiles={(f) => void handleFile(f)} />

        {!hasImage ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 h-48 rounded-lg border border-dashed border-border text-text-dim hover:text-text hover:border-accent cursor-pointer"
          >
            <ImagePlus size={28} />
            <span className="font-bold text-base">{t("stickers.pickImage")}</span>
            <span className="text-xs text-text-faint">{t("stickers.pickImageHint")}</span>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Segmented<Tool>
                value={tool}
                onChange={setTool}
                options={[
                  { value: "wand", label: t("stickers.wand") },
                  { value: "eraser", label: t("stickers.eraser") },
                ]}
              />
              <Button size="sm" variant="ghost" icon={<Undo2 size={13} />} disabled={!canUndo} onClick={undo}>
                {t("stickers.undo")}
              </Button>
            </div>
            <div className="text-xs text-text-faint -mt-1.5 flex items-center gap-1">
              {tool === "wand" ? <Wand2 size={12} /> : <Eraser size={12} />}
              {tool === "wand" ? t("stickers.wandHint") : t("stickers.eraserHint")}
            </div>

            <div className="rounded-md overflow-hidden border border-border flex items-center justify-center" style={{ background: CHECKERBOARD }}>
              <canvas
                ref={canvasRef}
                aria-label={t("stickers.editorTitle")}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={cn("max-w-full max-h-[300px] touch-none", tool === "wand" ? "cursor-crosshair" : "cursor-cell")}
              />
            </div>

            <label className="flex items-center gap-3 text-sm text-text-dim">
              <span className="w-28 flex-shrink-0">{tool === "wand" ? t("stickers.tolerance") : t("stickers.brushSize")}</span>
              <input
                type="range"
                min={tool === "wand" ? 1 : 4}
                max={tool === "wand" ? 60 : 48}
                value={tool === "wand" ? tolerance : brush}
                onChange={(e) => (tool === "wand" ? setTolerance : setBrush)(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
            </label>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-text-dim w-28">{t("stickers.shape")}</span>
              <Segmented<StickerShape>
                value={opts.shape}
                onChange={(v) => set("shape", v)}
                options={[
                  { value: "free", label: t("stickers.shapeFree") },
                  { value: "square", label: t("stickers.shapeSquare") },
                  { value: "circle", label: t("stickers.shapeCircle") },
                ]}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  id="stickerText"
                  label={t("stickers.text")}
                  placeholder={t("stickers.textPlaceholder")}
                  value={opts.text}
                  maxLength={40}
                  onChange={(e) => set("text", e.target.value)}
                />
              </div>
              <input
                type="color"
                value={opts.textColor}
                onChange={(e) => set("textColor", e.target.value)}
                aria-label={t("stickers.text")}
                className="w-10 h-[42px] rounded-md border border-border bg-input-bg cursor-pointer p-1"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Segmented<"top" | "bottom">
                value={opts.textPosition}
                onChange={(v) => set("textPosition", v)}
                options={[
                  { value: "top", label: t("stickers.textTop") },
                  { value: "bottom", label: t("stickers.textBottom") },
                ]}
              />
              <label className="flex items-center gap-2 text-sm font-bold text-text-dim cursor-pointer">
                <input type="checkbox" checked={opts.outline} onChange={(e) => set("outline", e.target.checked)} className="accent-[var(--accent)]" />
                {t("stickers.outline")}
              </label>
            </div>

            <div className="flex items-center gap-3">
              <canvas
                ref={previewRef}
                width={128}
                height={128}
                aria-label={t("stickers.preview")}
                className="rounded-md border border-border flex-shrink-0"
                style={{ background: CHECKERBOARD }}
              />
              <div className="text-sm text-text-dim">{t("stickers.preview")}</div>
            </div>
          </>
        )}

        {error && <div className="text-sm text-danger">{error}</div>}

        <div className="flex gap-2 justify-between">
          {hasImage ? (
            <Button variant="ghost" size="sm" icon={<ImagePlus size={13} />} onClick={() => fileRef.current?.click()}>
              {t("stickers.pickImage")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!hasImage || saving} onClick={() => void handleSave()}>
              {saving ? t("stickers.saving") : t("stickers.saveSticker")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
