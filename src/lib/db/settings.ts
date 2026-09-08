import { getDB } from "./index";
import { SETTINGS_ID, type SettingsRecord } from "./schema";
import type { Locale, PlaybackSnapshot, RecentlyPlayedEntry } from "@/types";

const RECENTLY_PLAYED_CAP = 8;

export function detectDefaultLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

function defaultSettings(): SettingsRecord {
  return {
    id: SETTINGS_ID,
    theme: "dark",
    locale: detectDefaultLocale(),
    volumeLevel: 70,
    playbackRate: 1,
    adFrequency: "off",
    songsPlayedCounter: 0,
    recentlyPlayed: [],
    playbackState: null,
  };
}

export async function getSettings(): Promise<SettingsRecord> {
  const db = await getDB();
  const existing = await db.get("settings", SETTINGS_ID);
  if (existing) {
    // Rows created before a field existed (e.g. locale, playbackRate) are
    // never auto-migrated by IndexedDB — backfill defaults for anything
    // missing and persist so future reads don't need to re-merge.
    const merged: SettingsRecord = { ...defaultSettings(), ...existing };
    if (Object.keys(existing).length < Object.keys(merged).length) {
      await db.put("settings", merged);
    }
    return merged;
  }
  const created = defaultSettings();
  await db.put("settings", created);
  return created;
}

export async function updateSettings(patch: Partial<Omit<SettingsRecord, "id">>): Promise<SettingsRecord> {
  const db = await getDB();
  const current = await getSettings();
  const updated: SettingsRecord = { ...current, ...patch };
  await db.put("settings", updated);
  return updated;
}

export async function pushRecentlyPlayed(entry: Omit<RecentlyPlayedEntry, "playedAt">): Promise<void> {
  const current = await getSettings();
  const deduped = current.recentlyPlayed.filter(
    (r) => !(r.playlistId === entry.playlistId && r.songId === entry.songId)
  );
  const next = [{ ...entry, playedAt: Date.now() }, ...deduped].slice(0, RECENTLY_PLAYED_CAP);
  await updateSettings({ recentlyPlayed: next });
}

export async function incrementSongsPlayedCounter(): Promise<number> {
  const current = await getSettings();
  const next = current.songsPlayedCounter + 1;
  await updateSettings({ songsPlayedCounter: next });
  return next;
}

export async function savePlaybackSnapshot(snapshot: PlaybackSnapshot | null): Promise<void> {
  await updateSettings({ playbackState: snapshot });
}

export async function loadPlaybackSnapshot(): Promise<PlaybackSnapshot | null> {
  const current = await getSettings();
  return current.playbackState;
}
