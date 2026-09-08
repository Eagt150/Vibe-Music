export type Theme = "dark" | "light";
export type RepeatMode = "off" | "all" | "one";
export type AdFrequency = 1 | 5 | 10 | 20 | "off";
export type Locale = "en" | "es";
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
export type SleepTimerOption = 15 | 30 | 60 | "end-of-track" | "off";

/** UI-facing playlist shape — never carries Blobs. */
export interface PlaylistMeta {
  id: string;
  name: string;
  hue: number;
  coverHash?: string;
  createdAt: number;
  order: number;
}

/** UI-facing song shape — never carries Blobs. */
export interface SongMeta {
  id: string;
  playlistId: string;
  title: string;
  artist: string;
  durationSec: number;
  favorite: boolean;
  orderIndex: number;
  mimeType: string;
  embeddedCoverHash?: string;
  contentHash?: string;
}

export interface QueueItem {
  playlistId: string;
  songId: string;
}

export interface RecentlyPlayedEntry {
  playlistId: string;
  songId: string;
  playedAt: number;
}

export interface PlaybackSnapshot {
  currentPlaylistId: string;
  currentSongId: string;
  queue: QueueItem[];
  playHistory: QueueItem[];
  progressSec: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
}

export interface NewSongInput {
  title: string;
  artist: string;
  durationSec: number;
  audioBlob: Blob;
  mimeType: string;
  embeddedCoverBlob?: Blob;
  /** Precomputed SHA-256 of audioBlob, if the caller already needed it (e.g.
   * duplicate detection during import) — avoids hashing the same bytes twice. */
  contentHash?: string;
}
