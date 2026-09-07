import type { IDBPTransaction, StoreNames } from "idb";
import { getDB } from "./index";
import type { VibeMusicDB } from "./schema";

export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Low-level upsert that operates inside an already-open, possibly
 * multi-store transaction (used by songs.ts so a song's metadata + audio
 * blob + cover reference commit atomically). The hash must be precomputed
 * (via `hashBlob`) BEFORE opening the transaction — hashing does real async
 * work outside of IndexedDB requests, which would otherwise let the browser
 * auto-close the transaction while we're waiting on it. */
export async function upsertCoverInTx(
  tx: IDBPTransaction<VibeMusicDB, StoreNames<VibeMusicDB>[], "readwrite">,
  hash: string,
  blob: Blob
): Promise<void> {
  const store = tx.objectStore("covers");
  const existing = await store.get(hash);
  if (existing) {
    await store.put({ ...existing, refCount: existing.refCount + 1 });
  } else {
    await store.put({ hash, blob, refCount: 1 });
  }
}

/** Stores a cover image, deduplicated by content hash. If an identical image
 * (e.g. the same embedded album art across an album's tracks) already exists,
 * its refCount is incremented and the existing hash is reused instead of
 * storing the bytes again. */
export async function saveCover(blob: Blob): Promise<string> {
  const hash = await hashBlob(blob);
  const db = await getDB();
  const tx = db.transaction("covers", "readwrite");
  const existing = await tx.store.get(hash);
  if (existing) {
    await tx.store.put({ ...existing, refCount: existing.refCount + 1 });
  } else {
    await tx.store.put({ hash, blob, refCount: 1 });
  }
  await tx.done;
  return hash;
}

export async function getCover(hash: string): Promise<Blob | undefined> {
  const db = await getDB();
  const record = await db.get("covers", hash);
  return record?.blob;
}

/** Decrements a cover's refCount, deleting the record once nothing references it. */
export async function releaseCover(hash: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("covers", "readwrite");
  const existing = await tx.store.get(hash);
  if (existing) {
    if (existing.refCount <= 1) {
      await tx.store.delete(hash);
    } else {
      await tx.store.put({ ...existing, refCount: existing.refCount - 1 });
    }
  }
  await tx.done;
}
