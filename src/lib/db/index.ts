import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type VibeMusicDB } from "./schema";

let dbPromise: Promise<IDBPDatabase<VibeMusicDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<VibeMusicDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VibeMusicDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const playlists = db.createObjectStore("playlists", { keyPath: "id" });
          playlists.createIndex("by_order", "order");
          playlists.createIndex("by_createdAt", "createdAt");

          const songs = db.createObjectStore("songs", { keyPath: "id" });
          songs.createIndex("by_playlistId", "playlistId");
          songs.createIndex("by_playlist_order", ["playlistId", "orderIndex"]);

          db.createObjectStore("audio_files", { keyPath: "songId" });
          db.createObjectStore("covers", { keyPath: "hash" });
          db.createObjectStore("settings", { keyPath: "id" });
        }
        if (oldVersion < 2) {
          // Existing rows from v1 have no contentHash — they're simply
          // absent from this index until re-imported, which is fine: they
          // still get caught by the fuzzy title/artist/duration check.
          transaction.objectStore("songs").createIndex("by_contentHash", "contentHash");
        }
      },
    });
  }
  return dbPromise;
}

/** Test-only: forces the next getDB() call to open a fresh connection.
 * Combine with resetting globalThis.indexedDB to a new IDBFactory in tests
 * so each test runs against an empty database. */
export function resetDBForTests(): void {
  dbPromise = null;
}
