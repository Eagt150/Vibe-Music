import { getStorageUsageRatio } from "./errors";
import { getRealDuration } from "./audio/getRealDuration";
import { extractMetadata } from "./metadata";
import { addSongs, findDuplicateSong } from "./db/songs";
import { hashBlob } from "./db/covers";
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
  skipped: string[];
  quotaWarning: boolean;
}

export type ImportProgressCallback = (completed: number, total: number) => void;

export type DuplicateDecision = "import" | "skip";

export interface DuplicateInfo {
  fileName: string;
  title: string;
  artist: string;
}

/** Called when a likely-duplicate is found; the UI shows a confirmation
 * dialog and resolves once the user answers. `applyToAll` lets the user's
 * answer apply to every remaining duplicate in this batch without asking
 * again. */
export type DuplicateResolver = (info: DuplicateInfo) => Promise<{ decision: DuplicateDecision; applyToAll: boolean }>;

async function processFile(file: File, unknownArtistLabel: string): Promise<NewSongInput> {
  const [durationSec, meta] = await Promise.all([getRealDuration(file), extractMetadata(file, unknownArtistLabel)]);
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
 * aborts the rest of the batch. `onProgress` fires after each file finishes
 * (success, failure, or skip) so the UI can show live "X / Y" feedback.
 * `onDuplicate`, if given, is asked before importing a song that already
 * looks like it's in the library (exact content match or same title/artist/
 * duration) — without it, duplicates are imported without asking. */
export async function importFilesToPlaylist(
  playlistId: string,
  files: File[],
  onProgress?: ImportProgressCallback,
  onDuplicate?: DuplicateResolver,
  unknownArtistLabel = "Unknown Artist"
): Promise<ImportResult> {
  const usageRatio = await getStorageUsageRatio();
  const quotaWarning = usageRatio !== null && usageRatio > QUOTA_WARNING_RATIO;

  const imported: SongRecord[] = [];
  const failures: ImportFailure[] = [];
  const skipped: string[] = [];
  let completed = 0;
  let forcedDecision: DuplicateDecision | null = null;

  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const chunkInputs: NewSongInput[] = [];

    for (const file of chunk) {
      try {
        const input = await processFile(file, unknownArtistLabel);
        const contentHash = await hashBlob(input.audioBlob);
        const duplicate = await findDuplicateSong(contentHash, input);

        if (duplicate) {
          let decision: DuplicateDecision | null = forcedDecision;
          if (!decision) {
            if (onDuplicate) {
              const answer = await onDuplicate({ fileName: file.name, title: input.title, artist: input.artist });
              decision = answer.decision;
              if (answer.applyToAll) forcedDecision = decision;
            } else {
              decision = "import";
            }
          }
          if (decision === "skip") {
            skipped.push(file.name);
            completed++;
            onProgress?.(completed, files.length);
            continue;
          }
        }

        chunkInputs.push({ ...input, contentHash });
      } catch (err) {
        failures.push({ fileName: file.name, message: err instanceof Error ? err.message : "Unsupported file." });
      }
      completed++;
      onProgress?.(completed, files.length);
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

  return { imported, failures, skipped, quotaWarning };
}
