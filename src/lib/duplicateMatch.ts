const DURATION_TOLERANCE_SEC = 2;

export function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A "likely duplicate" is the same title + artist (normalized) with a
 * duration within a couple seconds — this catches the same song imported
 * from a different file (different rip/bitrate) even though the bytes
 * differ. Exact byte-for-byte duplicates are caught separately via content
 * hash, which is more certain and doesn't need this fuzzy check. */
export function isFuzzyDuplicate(
  a: { title: string; artist: string; durationSec: number },
  b: { title: string; artist: string; durationSec: number }
): boolean {
  return (
    normalizeForMatch(a.title) === normalizeForMatch(b.title) &&
    normalizeForMatch(a.artist) === normalizeForMatch(b.artist) &&
    Math.abs(a.durationSec - b.durationSec) <= DURATION_TOLERANCE_SEC
  );
}
