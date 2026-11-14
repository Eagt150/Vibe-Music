import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLocale } from "@/i18n/LocaleContext";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { SearchBar } from "@/components/ui/SearchBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { StickerEditor } from "@/components/stickers/StickerEditor";
import { MAX_STICKERS } from "@/lib/stickerLimits";
import { fetchGifs, isKlipyEnabled, reportGifShare, type GifResult } from "@/lib/klipy";
import { convexErrorCode } from "@/lib/convexError";
import { cn } from "@/lib/cn";
import type { ConversationId } from "./types";

type Tab = "stickers" | "gifs";

interface MediaPickerProps {
  conversationId: ConversationId;
  myId: string;
  onClose: () => void;
  onError: (message: string) => void;
}

/** The panel above the composer: my stickers, and (if KLIPY is configured)
 * GIF search. */
export function MediaPicker({ conversationId, myId, onClose, onError }: MediaPickerProps) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("stickers");
  const [editorOpen, setEditorOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Clicks inside the editor modal (rendered on top) must not close the panel.
  useOnClickOutside(ref, () => {
    if (!editorOpen) onClose();
  });

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-3.5 right-3.5 md:left-5 md:right-auto md:w-[420px] mb-2 bg-surface border border-border rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.35)] flex flex-col h-[360px] z-20"
    >
      <div className="flex items-center gap-1 px-2 pt-2">
        {(["stickers", ...(isKlipyEnabled ? ["gifs" as const] : [])] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "px-3 py-1 rounded-pill text-sm font-bold cursor-pointer",
              tab === key ? "bg-accent text-accent-text" : "text-text-dim hover:text-text"
            )}
          >
            {key === "stickers" ? t("stickers.tab") : t("gifs.tab")}
          </button>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="p-1.5 text-text-dim hover:text-text cursor-pointer">
          <X size={15} />
        </button>
      </div>

      {tab === "stickers" ? (
        <StickersTab conversationId={conversationId} onSent={onClose} onError={onError} onCreate={() => setEditorOpen(true)} />
      ) : (
        <GifsTab conversationId={conversationId} myId={myId} onSent={onClose} onError={onError} />
      )}

      {editorOpen && <StickerEditor onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

function StickersTab({
  conversationId,
  onSent,
  onError,
  onCreate,
}: {
  conversationId: ConversationId;
  onSent: () => void;
  onError: (message: string) => void;
  onCreate: () => void;
}) {
  const { t } = useLocale();
  const stickers = useQuery(api.stickers.listMine);
  const sendSticker = useMutation(api.messages.sendSticker);
  const removeSticker = useMutation(api.stickers.remove);
  const [deleting, setDeleting] = useState<Id<"stickers"> | null>(null);
  const full = (stickers?.length ?? 0) >= MAX_STICKERS;

  async function send(stickerId: Id<"stickers">) {
    onSent();
    try {
      await sendSticker({ conversationId, stickerId });
    } catch (err) {
      onError(convexErrorCode(err) === "RATE_LIMITED" ? t("messages.errorRateLimited") : t("messages.errorSend"));
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs text-text-faint">{t("stickers.count", { count: stickers?.length ?? 0, max: MAX_STICKERS })}</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={onCreate}
          disabled={full}
          title={full ? t("stickers.limit", { max: MAX_STICKERS }) : t("stickers.create")}
          className="aspect-square rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-dim hover:text-text hover:border-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          <span className="text-xs font-bold text-center leading-tight px-1">{t("stickers.create")}</span>
        </button>
        {stickers?.map((s) => (
          <div key={s._id} className="relative group aspect-square">
            <button
              type="button"
              onClick={() => void send(s._id)}
              className="w-full h-full rounded-md hover:bg-surface-alt cursor-pointer p-1"
            >
              <img src={s.url} alt="" className="w-full h-full object-contain" loading="lazy" />
            </button>
            <button
              type="button"
              onClick={() => setDeleting(s._id)}
              aria-label={t("stickers.delete")}
              title={t("stickers.delete")}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-bg/80 text-text-dim hover:text-danger items-center justify-center hidden group-hover:flex focus:flex cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
      {stickers?.length === 0 && <p className="text-sm text-text-dim text-center px-4 py-4">{t("stickers.empty")}</p>}

      {deleting && (
        <ConfirmDialog
          title={t("stickers.deleteConfirmTitle")}
          body={t("stickers.deleteConfirmBody")}
          confirmLabel={t("stickers.delete")}
          danger
          onConfirm={() => {
            void removeSticker({ stickerId: deleting });
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function GifsTab({
  conversationId,
  myId,
  onSent,
  onError,
}: {
  conversationId: ConversationId;
  myId: string;
  onSent: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useLocale();
  const sendGif = useMutation(api.messages.sendGif);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<GifResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchGifs({ query: debounced, page, customerId: myId, signal: controller.signal })
      .then((res) => {
        // Shown exactly as returned: KLIPY's terms ask not to reorder or filter.
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setHasNext(res.hasNext);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [debounced, page, myId]);

  async function send(gif: GifResult) {
    onSent();
    reportGifShare(gif.slug, myId, debounced);
    try {
      await sendGif({
        conversationId,
        gif: { slug: gif.slug, url: gif.full.url, width: gif.full.width, height: gif.full.height },
      });
    } catch (err) {
      onError(convexErrorCode(err) === "RATE_LIMITED" ? t("messages.errorRateLimited") : t("messages.errorSend"));
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-2 pt-2">
        <SearchBar value={query} onChange={setQuery} placeholder={t("gifs.searchPlaceholder")} className="w-full" autoFocus />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {status === "error" && <p className="text-sm text-text-dim text-center py-6">{t("gifs.error")}</p>}
        {status === "ready" && items.length === 0 && <p className="text-sm text-text-dim text-center py-6">{t("gifs.noResults")}</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((gif, i) => (
            <button
              key={`${gif.slug}-${i}`}
              type="button"
              onClick={() => void send(gif)}
              title={gif.title}
              className="aspect-square rounded-md overflow-hidden bg-surface-alt cursor-pointer hover:ring-2 hover:ring-accent"
              style={gif.blurPreview ? { backgroundImage: `url(${gif.blurPreview})`, backgroundSize: "cover" } : undefined}
            >
              <img src={gif.preview.url} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
        {hasNext && status === "ready" && (
          <div className="flex justify-center pt-2">
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => p + 1)}>
              {t("gifs.loadMore")}
            </Button>
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-border text-xs text-text-faint text-right">{t("gifs.poweredBy")}</div>
    </div>
  );
}
