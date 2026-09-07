export type Theme = "dark" | "light";
export type RepeatMode = "off" | "all" | "one";
export type AdFrequency = 1 | 5 | 10 | 20 | "off";

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
}
