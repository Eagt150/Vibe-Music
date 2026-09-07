import { getStorageUsageRatio } from "./errors";
import { getRealDuration } from "./audio/getRealDuration";
import { extractMetadata } from "./metadata";
import { addSongs } from "./db/songs";
import type { SongRecord } from "./db/schema";
import type { NewSongInput } from "@/types";

// Files are processed a few at a time, sequentially, rather than all at
// once — reading 200 files' full duration + ID3 metadata simultaneously
// would hold that many decoded Blobs in memory and can crash the tab.
const CHUNK_SIZE = 4;
const QUOTA_WARNING_RATIO = 0.85;

export interface ImportFailure {
  fileName: string;
  message: string;
}

export interface ImportResult {
  imported: SongRecord[];
  failures: ImportFailure[];
  quotaWarning: boolean;
}

async function processFile(file: File): Promise<NewSongInput> {
  const [durationSec, meta] = await Promise.all([getRealDuration(file), extractMetadata(file)]);
  return {
    title: meta.title,
    artist: meta.artist,
    durationSec,
    audioBlob: file,
    mimeType: file.type || "audio/mpeg",
    embeddedCoverBlob: meta.coverBlob,
  };
}

/** Imports a batch of audio files into a playlist. Processes files in small
 * sequential chunks (never all at once) so the browser isn't asked to hold
 * many decoded audio files in memory simultaneously, and each chunk's DB
 * write is one atomic transaction. A failure on one file (unsupported
 * format, corrupt data, storage quota) is recorded and skipped — it never
 * aborts the rest of the batch. */
export async function importFilesToPlaylist(playlistId: string, files: File[]): Promise<ImportResult> {
  const usageRatio = await getStorageUsageRatio();
  const quotaWarning = usageRatio !== null && usageRatio > QUOTA_WARNING_RATIO;

  const imported: SongRecord[] = [];
  const failures: ImportFailure[] = [];

  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const chunkInputs: NewSongInput[] = [];

    for (const file of chunk) {
      try {
        chunkInputs.push(await processFile(file));
      } catch (err) {
        failures.push({ fileName: file.name, message: err instanceof Error ? err.message : "Unsupported file." });
      }
    }

    if (chunkInputs.length === 0) continue;

    try {
      const created = await addSongs(playlistId, chunkInputs);
      imported.push(...created);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save this file — storage may be full.";
      for (const input of chunkInputs) failures.push({ fileName: input.title, message });
    }
  }

  return { imported, failures, quotaWarning };
}
