import { fisherYatesShuffle } from "./shuffle";
import type { QueueItem, RepeatMode } from "@/types";

/** Rest of a playlist after the starting song, optionally shuffled. Pure and
 * independently testable without a real <audio> element. */
export function buildQueue(
  orderedSongs: { id: string }[],
  startSongId: string,
  shuffle: boolean,
  playlistId: string,
  shuffleFn: <T>(items: T[]) => T[] = fisherYatesShuffle
): QueueItem[] {
  const startIdx = orderedSongs.findIndex((s) => s.id === startSongId);
  const rest = startIdx === -1 ? orderedSongs.slice() : orderedSongs.slice(startIdx + 1);
  const ordered = shuffle ? shuffleFn(rest) : rest;
  return ordered.map((s) => ({ playlistId, songId: s.id }));
}

export interface NextDecisionInput {
  queue: QueueItem[];
  repeatMode: RepeatMode;
  playingPlaylistId: string | null;
  orderedSongsInCurrentPlaylist: { id: string }[];
  /** True when next() was triggered by the current song ending on its own.
   * Repeat-one only takes over on a natural end — a manual "skip to next"
   * click should always advance, exactly like every other player. */
  fromEnded: boolean;
}

export type NextDecision =
  | { action: "play"; item: QueueItem; remainingQueue: QueueItem[] }
  | { action: "restart-same" }
  | { action: "restart-playlist"; item: QueueItem; queue: QueueItem[] }
  | { action: "stop" };

/** The decision for what next() should do: (1) on a natural end with
 * repeat-one, restart the same song regardless of the queue, (2) otherwise
 * pop the queue if non-empty, (3) rebuild the queue from the top of the
 * playlist if repeat-all and the queue is exhausted, (4) otherwise stop. */
export function decideNext(input: NextDecisionInput): NextDecision {
  const { queue, repeatMode, playingPlaylistId, orderedSongsInCurrentPlaylist, fromEnded } = input;

  if (fromEnded && repeatMode === "one") {
    return { action: "restart-same" };
  }
  if (queue.length > 0) {
    const [item, ...remainingQueue] = queue;
    return { action: "play", item, remainingQueue };
  }
  if (repeatMode === "all" && playingPlaylistId && orderedSongsInCurrentPlaylist.length > 0) {
    const [first, ...rest] = orderedSongsInCurrentPlaylist;
    const queueFromRest = rest.map((s) => ({ playlistId: playingPlaylistId, songId: s.id }));
    return { action: "restart-playlist", item: { playlistId: playingPlaylistId, songId: first.id }, queue: queueFromRest };
  }
  return { action: "stop" };
}

export type PrevDecision = { action: "play"; item: QueueItem; remainingHistory: QueueItem[] } | { action: "noop" };

/** prev() pops the real play-history stack — the songs that actually just
 * played, in the order they played — rather than stepping through the
 * playlist's original order. This matters most in shuffle mode: pressing
 * "prev" always returns to what you just heard, never to an unrelated
 * "previous in playlist order" track. */
export function decidePrev(playHistory: QueueItem[]): PrevDecision {
  if (playHistory.length === 0) return { action: "noop" };
  const item = playHistory[playHistory.length - 1];
  const remainingHistory = playHistory.slice(0, -1);
  return { action: "play", item, remainingHistory };
}

const HISTORY_CAP = 50;

export function pushHistory(history: QueueItem[], item: QueueItem): QueueItem[] {
  const next = [...history, item];
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
}
