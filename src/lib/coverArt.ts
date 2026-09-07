/** Deterministic 32-bit hash — same title always yields the same hue/glyph,
 * so a playlist's auto-generated cover doesn't shuffle on every render. */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function hueFromString(str: string): number {
  return hashString(str) % 360;
}

export interface QuadrantSwatch {
  hue: number;
  glyph: string;
}

/** Builds the 2x2 auto-collage from up to the first 4 song titles, looping
 * through them if the playlist has fewer than 4 songs. Returns [] for an
 * empty playlist — callers should render the "ADD SONGS" placeholder instead. */
export function buildQuadrants(songTitles: string[]): QuadrantSwatch[] {
  if (songTitles.length === 0) return [];
  return Array.from({ length: 4 }, (_, i) => {
    const title = songTitles[i % songTitles.length];
    return { hue: hueFromString(title), glyph: (title.trim()[0] ?? "?").toUpperCase() };
  });
}

export type CoverFill =
  | { kind: "image"; blob: Blob }
  | { kind: "quadrants"; swatches: QuadrantSwatch[] }
  | { kind: "empty-placeholder" };

/** Decides what a playlist's cover should render as. `coverBlob` is expected
 * to already be resolved (via covers.getCover(hash)) by the caller — this
 * function never touches IndexedDB itself. */
export function resolveCoverFill(coverBlob: Blob | undefined, songTitles: string[]): CoverFill {
  if (coverBlob) return { kind: "image", blob: coverBlob };
  if (songTitles.length === 0) return { kind: "empty-placeholder" };
  return { kind: "quadrants", swatches: buildQuadrants(songTitles) };
}
