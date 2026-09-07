import { parseBlob } from "music-metadata";

export interface ExtractedMetadata {
  title: string;
  artist: string;
  coverBlob?: Blob;
}

function titleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");
  const spaced = withoutExt.replace(/[_-]+/g, " ").trim();
  if (!spaced) return "Untitled";
  return spaced.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/** Reads ID3/Vorbis/MP4 tags for title/artist/embedded cover art. Falls back
 * to a filename-derived title + "Unknown Artist" when tags are missing or
 * unparseable — this never throws, importing an untagged file always
 * succeeds with reasonable defaults. */
export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  const fallback: ExtractedMetadata = { title: titleFromFileName(file.name), artist: "Unknown Artist" };
  try {
    const parsed = await parseBlob(file);
    const common = parsed.common;
    const title = common.title?.trim() || fallback.title;
    const artist = common.artist?.trim() || fallback.artist;
    const picture = common.picture?.[0];
    // music-metadata types picture.data as Uint8Array<ArrayBufferLike>, which
    // TS won't accept as a BlobPart (Blob requires a concrete ArrayBuffer,
    // not the wider ArrayBufferLike) — the bytes are valid regardless.
    const coverBlob = picture ? new Blob([picture.data as unknown as BlobPart], { type: picture.format }) : undefined;
    return { title, artist, coverBlob };
  } catch {
    return fallback;
  }
}
