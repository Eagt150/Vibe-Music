import type { DBSchema } from "idb";
import type { AdFrequency, Locale, PlaybackSnapshot, RecentlyPlayedEntry, Theme } from "@/types";

/** Internal DB records — these carry Blobs and never leave the db/ layer directly. */
export interface PlaylistRecord {
  id: string;
  name: string;
  hue: number;
  coverHash?: string;
  createdAt: number;
  order: number;
}

/** Song metadata only — the audio Blob lives in a separate store (`audio_files`)
 * so listing/searching thousands of songs never has to touch heavy binary data. */
export interface SongRecord {
  id: string;
  playlistId: string;
  title: string;
  artist: string;
  durationSec: number;
  favorite: boolean;
  orderIndex: number;
  mimeType: string;
  embeddedCoverHash?: string;
  /** SHA-256 of the audio Blob's bytes — lets duplicate-import detection find
   * an exact re-import in O(1) via the by_contentHash index. Songs imported
   * before this field existed simply have no hash and are only matched by
   * the fuzzy title/artist/duration check. */
  contentHash?: string;
}

export interface AudioFileRecord {
  songId: string;
  audioBlob: Blob;
}

/** Deduplicated cover images, keyed by content hash — a custom playlist cover
 * or an embedded ID3 cover shared across an album's tracks is stored once. */
export interface CoverRecord {
  hash: string;
  blob: Blob;
  refCount: number;
}

export const SETTINGS_ID = "app-settings" as const;

export interface SettingsRecord {
  id: typeof SETTINGS_ID;
  theme: Theme;
  locale: Locale;
  volumeLevel: number;
  playbackRate: number;
  adFrequency: AdFrequency;
  songsPlayedCounter: number;
  recentlyPlayed: RecentlyPlayedEntry[];
  playbackState: PlaybackSnapshot | null;
}

export interface VibeMusicDB extends DBSchema {
  playlists: {
    key: string;
    value: PlaylistRecord;
    indexes: { by_order: number; by_createdAt: number };
  };
  songs: {
    key: string;
    value: SongRecord;
    indexes: { by_playlistId: string; by_playlist_order: [string, number]; by_contentHash: string };
  };
  audio_files: {
    key: string;
    value: AudioFileRecord;
  };
  covers: {
    key: string;
    value: CoverRecord;
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
}

export const DB_NAME = "vibe-music";
export const DB_VERSION = 2;
