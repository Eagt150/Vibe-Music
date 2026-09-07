import { getDB } from "./index";
import { releaseCover, saveCover } from "./covers";
import type { PlaylistRecord } from "./schema";

const MY_MUSIC_NAME = "My Music";

export async function createPlaylist(name: string, hue: number = Math.floor(Math.random() * 360)): Promise<PlaylistRecord> {
  const db = await getDB();
  const all = await db.getAllFromIndex("playlists", "by_order");
  const record: PlaylistRecord = {
    id: crypto.randomUUID(),
    name,
    hue,
    createdAt: Date.now(),
    order: all.length,
  };
  await db.put("playlists", record);
  return record;
}

export async function getPlaylist(id: string): Promise<PlaylistRecord | undefined> {
  const db = await getDB();
  return db.get("playlists", id);
}

export async function getAllPlaylists(): Promise<PlaylistRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("playlists", "by_order");
}

export async function updatePlaylistName(id: string, name: string): Promise<void> {
  const db = await getDB();
  const record = await db.get("playlists", id);
  if (!record) return;
  await db.put("playlists", { ...record, name });
}

/** Replaces the playlist's custom cover, releasing the old one (if any) so
 * shared/deduplicated images don't leak refCount. */
export async function updatePlaylistCover(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  const record = await db.get("playlists", id);
  if (!record) return;
  const newHash = await saveCover(blob);
  const oldHash = record.coverHash;
  await db.put("playlists", { ...record, coverHash: newHash });
  if (oldHash && oldHash !== newHash) {
    await releaseCover(oldHash);
  }
}

/** Deletes a playlist and cascades: its songs, their audio blobs, and releases
 * any cover references (playlist cover + each song's embedded cover). */
export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDB();
  const playlist = await db.get("playlists", id);
  const songs = await db.getAllFromIndex("songs", "by_playlistId", id);

  const tx = db.transaction(["playlists", "songs", "audio_files"], "readwrite");
  await tx.objectStore("playlists").delete(id);
  for (const song of songs) {
    await tx.objectStore("songs").delete(song.id);
    await tx.objectStore("audio_files").delete(song.id);
  }
  await tx.done;

  if (playlist?.coverHash) await releaseCover(playlist.coverHash);
  for (const song of songs) {
    if (song.embeddedCoverHash) await releaseCover(song.embeddedCoverHash);
  }
}

export async function reorderPlaylists(orderedIds: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("playlists", "readwrite");
  for (let i = 0; i < orderedIds.length; i++) {
    const record = await tx.store.get(orderedIds[i]);
    if (record) await tx.store.put({ ...record, order: i });
  }
  await tx.done;
}

/** Reused across file imports that don't target an explicit playlist — the
 * first import creates "My Music", subsequent ones append to it. */
export async function findOrCreateMyMusicPlaylist(): Promise<PlaylistRecord> {
  const all = await getAllPlaylists();
  const existing = all.find((p) => p.name === MY_MUSIC_NAME);
  if (existing) return existing;
  return createPlaylist(MY_MUSIC_NAME, 205);
}
