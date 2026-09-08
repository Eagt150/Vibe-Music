import { getDB } from "./index";
import { hashBlob, releaseCover, upsertCoverInTx } from "./covers";
import { isFuzzyDuplicate } from "@/lib/duplicateMatch";
import type { SongRecord } from "./schema";
import type { NewSongInput } from "@/types";

export async function getSongsForPlaylist(playlistId: string): Promise<SongRecord[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound([playlistId, -Infinity], [playlistId, Infinity]);
  return db.getAllFromIndex("songs", "by_playlist_order", range);
}

export async function getSong(id: string): Promise<SongRecord | undefined> {
  const db = await getDB();
  return db.get("songs", id);
}

export async function countSongsForPlaylist(playlistId: string): Promise<number> {
  const db = await getDB();
  return db.countFromIndex("songs", "by_playlistId", playlistId);
}

/** The only place the heavy audio Blob is read back out of IndexedDB —
 * called just before handing it to the `<audio>` element, never when
 * rendering lists. */
export async function getAudioBlob(songId: string): Promise<Blob | undefined> {
  const db = await getDB();
  const record = await db.get("audio_files", songId);
  return record?.audioBlob;
}

/** Checks whether a song already exists in the library: first by exact
 * content hash (certain — the same file bytes), then by fuzzy title/artist/
 * duration match (catches the same song from a different rip/encode). Checks
 * across the whole library, not just one playlist, since importing the same
 * song into two different playlists is still worth flagging. */
export async function findDuplicateSong(
  contentHash: string,
  candidate: { title: string; artist: string; durationSec: number }
): Promise<SongRecord | undefined> {
  const db = await getDB();
  const exact = await db.getFromIndex("songs", "by_contentHash", contentHash);
  if (exact) return exact;

  const all = await db.getAll("songs");
  return all.find((s) => isFuzzyDuplicate(s, candidate));
}

/** Inserts one song's metadata + audio blob + (optional) cover reference in a
 * single atomic transaction across 3 stores: if writing the audio blob fails
 * (e.g. QuotaExceededError), the whole transaction rolls back — no orphaned
 * metadata row, no dangling cover refCount. */
export async function addSong(playlistId: string, input: NewSongInput): Promise<SongRecord> {
  const db = await getDB();
  const nextOrderIndex = await countSongsForPlaylist(playlistId);

  // Hashing is real async work outside of IndexedDB requests — it must happen
  // BEFORE the transaction opens, otherwise the browser can auto-close the
  // transaction while we're waiting on it.
  const embeddedCoverHash = input.embeddedCoverBlob ? await hashBlob(input.embeddedCoverBlob) : undefined;
  const contentHash = input.contentHash ?? (await hashBlob(input.audioBlob));

  const record: SongRecord = {
    id: crypto.randomUUID(),
    playlistId,
    title: input.title,
    artist: input.artist,
    durationSec: input.durationSec,
    favorite: false,
    orderIndex: nextOrderIndex,
    mimeType: input.mimeType,
    embeddedCoverHash,
    contentHash,
  };

  const tx = db.transaction(["songs", "audio_files", "covers"], "readwrite");
  if (embeddedCoverHash && input.embeddedCoverBlob) {
    await upsertCoverInTx(tx, embeddedCoverHash, input.embeddedCoverBlob);
  }
  await tx.objectStore("songs").put(record);
  await tx.objectStore("audio_files").put({ songId: record.id, audioBlob: input.audioBlob });
  await tx.done;

  return record;
}

/** Adds several songs as one atomic transaction. Callers doing a large batch
 * import should call this in small chunks (e.g. 3-5 files) rather than all
 * at once — see src/lib/importFiles.ts — so the browser isn't asked to hold
 * dozens of decoded audio Blobs in memory simultaneously. */
export async function addSongs(playlistId: string, items: NewSongInput[]): Promise<SongRecord[]> {
  if (items.length === 0) return [];
  const db = await getDB();
  let nextOrderIndex = await countSongsForPlaylist(playlistId);

  const coverHashes = await Promise.all(
    items.map((item) => (item.embeddedCoverBlob ? hashBlob(item.embeddedCoverBlob) : Promise.resolve(undefined)))
  );
  const contentHashes = await Promise.all(items.map((item) => item.contentHash ?? hashBlob(item.audioBlob)));

  const records: SongRecord[] = items.map((input, i) => ({
    id: crypto.randomUUID(),
    playlistId,
    title: input.title,
    artist: input.artist,
    durationSec: input.durationSec,
    favorite: false,
    orderIndex: nextOrderIndex++,
    mimeType: input.mimeType,
    embeddedCoverHash: coverHashes[i],
    contentHash: contentHashes[i],
  }));

  const tx = db.transaction(["songs", "audio_files", "covers"], "readwrite");
  for (let i = 0; i < items.length; i++) {
    const hash = coverHashes[i];
    const coverBlob = items[i].embeddedCoverBlob;
    if (hash && coverBlob) await upsertCoverInTx(tx, hash, coverBlob);
    await tx.objectStore("songs").put(records[i]);
    await tx.objectStore("audio_files").put({ songId: records[i].id, audioBlob: items[i].audioBlob });
  }
  await tx.done;

  return records;
}

export async function updateSongFavorite(id: string, favorite: boolean): Promise<void> {
  const db = await getDB();
  const record = await db.get("songs", id);
  if (!record) return;
  await db.put("songs", { ...record, favorite });
}

export async function deleteSong(id: string): Promise<void> {
  const db = await getDB();
  const record = await db.get("songs", id);
  if (!record) return;

  const tx = db.transaction(["songs", "audio_files"], "readwrite");
  await tx.objectStore("songs").delete(id);
  await tx.objectStore("audio_files").delete(id);
  await tx.done;

  if (record.embeddedCoverHash) await releaseCover(record.embeddedCoverHash);
}

/** Rewrites orderIndex 0..n-1 to match the given order, in one transaction. */
export async function reorderSongs(playlistId: string, orderedSongIds: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("songs", "readwrite");
  for (let i = 0; i < orderedSongIds.length; i++) {
    const record = await tx.store.get(orderedSongIds[i]);
    if (record && record.playlistId === playlistId) {
      await tx.store.put({ ...record, orderIndex: i });
    }
  }
  await tx.done;
}

/** Moves a song to a different playlist — just repoints playlistId and
 * appends it to the end of the destination, no audio/cover data is touched. */
export async function moveSongToPlaylist(songId: string, targetPlaylistId: string): Promise<void> {
  const db = await getDB();
  const record = await db.get("songs", songId);
  if (!record || record.playlistId === targetPlaylistId) return;
  const nextOrderIndex = await countSongsForPlaylist(targetPlaylistId);
  await db.put("songs", { ...record, playlistId: targetPlaylistId, orderIndex: nextOrderIndex });
}
