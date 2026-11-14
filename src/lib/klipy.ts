// KLIPY GIF API (https://docs.klipy.com). Their integration rules shape this
// file: requests go straight from the user's browser (no proxy through our
// backend), media is loaded from the URLs they return (never re-hosted), and
// results are shown in the order they come back, unfiltered. Sending a GIF
// reports a "share" so their analytics work.
//
// The key is a public client key (it ends up in browser requests anyway). If
// it is missing, or KLIPY stops answering, the GIF tab just doesn't show up —
// the rest of the app never depends on it.

const API_KEY = (import.meta.env.VITE_KLIPY_API_KEY as string | undefined)?.trim() || null;
const BASE = "https://api.klipy.com/api/v1";
const PER_PAGE = 24;

export const isKlipyEnabled = API_KEY !== null;

interface KlipyFile {
  url: string;
  width: number;
  height: number;
}
type KlipySize = Partial<Record<"gif" | "webp" | "jpg" | "mp4" | "webm", KlipyFile>>;
interface KlipyItem {
  id: number;
  slug: string;
  title?: string;
  type?: string;
  blur_preview?: string;
  file?: Partial<Record<"hd" | "md" | "sm" | "xs", KlipySize>>;
}

export interface GifResult {
  slug: string;
  title: string;
  /** Small animated version for the picker grid. */
  preview: KlipyFile;
  /** What goes into the message. */
  full: KlipyFile;
  blurPreview: string | null;
}

export interface GifPage {
  items: GifResult[];
  hasNext: boolean;
}

function pick(size: KlipySize | undefined): KlipyFile | null {
  return size?.webp ?? size?.gif ?? null;
}

function toResult(item: KlipyItem): GifResult | null {
  const preview = pick(item.file?.sm) ?? pick(item.file?.xs) ?? pick(item.file?.md);
  const full = pick(item.file?.md) ?? pick(item.file?.hd) ?? preview;
  if (!preview || !full) return null;
  return { slug: item.slug, title: item.title ?? "", preview, full, blurPreview: item.blur_preview ?? null };
}

export async function fetchGifs(opts: { query: string; page: number; customerId: string; signal?: AbortSignal }): Promise<GifPage> {
  if (!API_KEY) throw new Error("KLIPY is not configured");
  const q = opts.query.trim();
  const params = new URLSearchParams({ page: String(opts.page), per_page: String(PER_PAGE), customer_id: opts.customerId });
  if (q) params.set("q", q);
  const url = `${BASE}/${encodeURIComponent(API_KEY)}/gifs/${q ? "search" : "trending"}?${params}`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`KLIPY ${res.status}`);
  const json = (await res.json()) as { result?: boolean; data?: { data?: KlipyItem[]; has_next?: boolean } };
  const items = (json.data?.data ?? []).map(toResult).filter((r): r is GifResult => r !== null);
  return { items, hasNext: json.data?.has_next ?? false };
}

/** Tells KLIPY a GIF was sent. Best-effort: a failure here never blocks the message. */
export function reportGifShare(slug: string, customerId: string, query: string) {
  if (!API_KEY) return;
  void fetch(`${BASE}/${encodeURIComponent(API_KEY)}/gifs/share/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId, q: query.trim() }),
  }).catch(() => {});
}
