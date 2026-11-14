import { contentBounds } from "./stickerTools";

export const STICKER_SIZE = 512;
const PADDING = 28;
const OUTLINE_PX = 10;

export type StickerShape = "free" | "square" | "circle";

export interface StickerOptions {
  shape: StickerShape;
  text: string;
  textPosition: "top" | "bottom";
  textColor: string;
  outline: boolean;
}

/** Fits the edited picture into a 512×512 transparent square: crop by shape,
 * optional white border, optional caption. Returns null if nothing is left
 * to show (everything erased). */
export function composeSticker(source: ImageData, opts: StickerOptions): HTMLCanvasElement | null {
  const src = document.createElement("canvas");
  src.width = source.width;
  src.height = source.height;
  src.getContext("2d")!.putImageData(source, 0, 0);

  // Area of the source to use.
  let crop: { x: number; y: number; width: number; height: number } | null;
  if (opts.shape === "free") {
    crop = contentBounds(source);
  } else {
    const side = Math.min(source.width, source.height);
    crop = { x: (source.width - side) / 2, y: (source.height - side) / 2, width: side, height: side };
  }
  if (crop === null) return null;

  const out = document.createElement("canvas");
  out.width = STICKER_SIZE;
  out.height = STICKER_SIZE;
  const ctx = out.getContext("2d")!;

  const box = STICKER_SIZE - PADDING * 2;
  const scale = Math.min(box / crop.width, box / crop.height);
  const w = crop.width * scale;
  const h = crop.height * scale;
  const x = (STICKER_SIZE - w) / 2;
  const y = (STICKER_SIZE - h) / 2;

  // The subject, cropped and (for a circle) masked, on its own layer.
  const layer = document.createElement("canvas");
  layer.width = STICKER_SIZE;
  layer.height = STICKER_SIZE;
  const lctx = layer.getContext("2d")!;
  lctx.imageSmoothingQuality = "high";
  lctx.drawImage(src, crop.x, crop.y, crop.width, crop.height, x, y, w, h);
  if (opts.shape === "circle") {
    lctx.globalCompositeOperation = "destination-in";
    lctx.beginPath();
    lctx.arc(STICKER_SIZE / 2, STICKER_SIZE / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    lctx.fill();
    lctx.globalCompositeOperation = "source-over";
  }

  if (opts.outline) {
    // White silhouette of the layer, stamped around in a ring = a border that
    // follows the cut-out's shape.
    const silhouette = document.createElement("canvas");
    silhouette.width = STICKER_SIZE;
    silhouette.height = STICKER_SIZE;
    const sctx = silhouette.getContext("2d")!;
    sctx.drawImage(layer, 0, 0);
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, STICKER_SIZE, STICKER_SIZE);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(silhouette, Math.cos(a) * OUTLINE_PX, Math.sin(a) * OUTLINE_PX);
    }
  }
  ctx.drawImage(layer, 0, 0);

  const text = opts.text.trim();
  if (text) drawCaption(ctx, text, opts.textPosition, opts.textColor);
  return out;
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, position: "top" | "bottom", color: string) {
  const maxWidth = STICKER_SIZE - 40;
  let size = 64;
  ctx.textAlign = "center";
  ctx.textBaseline = position === "top" ? "top" : "bottom";
  do {
    ctx.font = `800 ${size}px Manrope, "Helvetica Neue", Arial, sans-serif`;
    size -= 4;
  } while (ctx.measureText(text).width > maxWidth && size > 20);

  const y = position === "top" ? 18 : STICKER_SIZE - 18;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(6, size / 6);
  ctx.strokeStyle = isLight(color) ? "#000000" : "#ffffff";
  ctx.strokeText(text, STICKER_SIZE / 2, y, maxWidth);
  ctx.fillStyle = color;
  ctx.fillText(text, STICKER_SIZE / 2, y, maxWidth);
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return true;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** WebP where the browser can encode it (most), PNG otherwise (older Safari). */
export async function canvasToStickerBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const encode = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.9);
  if (webp && webp.type === "image/webp") return webp;
  const png = await encode("image/png");
  if (!png) throw new Error("Could not encode sticker");
  return png;
}

/** Loads a picked file into pixels, scaled down so the longest side is at
 * most `maxSide` (keeps the wand and eraser fast). */
export async function loadImagePixels(file: File, maxSide = 512): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return ctx.getImageData(0, 0, w, h);
}
