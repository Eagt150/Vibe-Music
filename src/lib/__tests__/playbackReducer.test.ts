import { describe, expect, it } from "vitest";
import { buildQueue, decideNext, decidePrev, pushHistory } from "../playbackReducer";

const noShuffle = <T,>(items: T[]) => items;
const reverseShuffle = <T,>(items: T[]) => [...items].reverse();

describe("buildQueue", () => {
  const songs = [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }];

  it("returns the rest of the playlist after the start song, unshuffled", () => {
    const queue = buildQueue(songs, "s2", false, "p1", noShuffle);
    expect(queue).toEqual([
      { playlistId: "p1", songId: "s3" },
      { playlistId: "p1", songId: "s4" },
    ]);
  });

  it("shuffles the rest when shuffle is on", () => {
    const queue = buildQueue(songs, "s1", true, "p1", reverseShuffle);
    expect(queue).toEqual([
      { playlistId: "p1", songId: "s4" },
      { playlistId: "p1", songId: "s3" },
      { playlistId: "p1", songId: "s2" },
    ]);
  });

  it("returns everything if the start song isn't found", () => {
    const queue = buildQueue(songs, "missing", false, "p1", noShuffle);
    expect(queue).toHaveLength(4);
  });
});

describe("decideNext", () => {
  it("plays the next queued item when the queue is non-empty and repeat is off", () => {
    const decision = decideNext({
      queue: [{ playlistId: "p1", songId: "s2" }, { playlistId: "p1", songId: "s3" }],
      repeatMode: "off",
      playingPlaylistId: "p1",
      orderedSongsInCurrentPlaylist: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      fromEnded: false,
    });
    expect(decision).toEqual({
      action: "play",
      item: { playlistId: "p1", songId: "s2" },
      remainingQueue: [{ playlistId: "p1", songId: "s3" }],
    });
  });

  it("restarts the same song on a natural end when repeat-one is active, even with a non-empty queue", () => {
    const decision = decideNext({
      queue: [{ playlistId: "p1", songId: "s2" }, { playlistId: "p1", songId: "s3" }],
      repeatMode: "one",
      playingPlaylistId: "p1",
      orderedSongsInCurrentPlaylist: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      fromEnded: true,
    });
    expect(decision).toEqual({ action: "restart-same" });
  });

  it("restarts the same song when repeat-one and the queue is empty", () => {
    const decision = decideNext({
      queue: [],
      repeatMode: "one",
      playingPlaylistId: "p1",
      orderedSongsInCurrentPlaylist: [{ id: "s1" }],
      fromEnded: true,
    });
    expect(decision).toEqual({ action: "restart-same" });
  });

  it("a manual skip (not fromEnded) still advances the queue even with repeat-one active", () => {
    const decision = decideNext({
      queue: [{ playlistId: "p1", songId: "s2" }],
      repeatMode: "one",
      playingPlaylistId: "p1",
      orderedSongsInCurrentPlaylist: [{ id: "s1" }, { id: "s2" }],
      fromEnded: false,
    });
    expect(decision).toEqual({
      action: "play",
      item: { playlistId: "p1", songId: "s2" },
      remainingQueue: [],
    });
  });

  it("rebuilds the queue from the top of the playlist when repeat-all and the queue is empty", () => {
    const decision = decideNext({
      queue: [],
      repeatMode: "all",
      playingPlaylistId: "p1",
      orderedSongsInCurrentPlaylist: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
      fromEnded: true,
    });
    expect(decision).toEqual({
      action: "restart-playlist",
      item: { playlistId: "p1", songId: "s1" },
      queue: [
        { playlistId: "p1", songId: "s2" },
        { playlistId: "p1", songId: "s3" },
      ],
    });
  });

  it("stops when the queue is empty and repeat is off", () => {
    const decision = decideNext({
      queue: [],
      repeatMode: "off",
      playingPlaylistId: "p1",
      orderedSongsInCurrentPlaylist: [{ id: "s1" }],
      fromEnded: true,
    });
    expect(decision).toEqual({ action: "stop" });
  });
});

describe("decidePrev — real play history, not playlist order", () => {
  it("is a no-op with empty history", () => {
    expect(decidePrev([])).toEqual({ action: "noop" });
  });

  it("pops the most recently played item, not the playlist's previous track", () => {
    // Simulates: user shuffled through s3 -> s1 -> s4 (playlist original order is s1,s2,s3,s4).
    const history = [
      { playlistId: "p1", songId: "s3" },
      { playlistId: "p1", songId: "s1" },
    ];
    const decision = decidePrev(history);
    expect(decision).toEqual({
      action: "play",
      item: { playlistId: "p1", songId: "s1" },
      remainingHistory: [{ playlistId: "p1", songId: "s3" }],
    });
  });
});

describe("pushHistory", () => {
  it("appends to the end", () => {
    const result = pushHistory([{ playlistId: "p1", songId: "s1" }], { playlistId: "p1", songId: "s2" });
    expect(result).toEqual([
      { playlistId: "p1", songId: "s1" },
      { playlistId: "p1", songId: "s2" },
    ]);
  });

  it("caps at 50 entries, dropping the oldest", () => {
    const history = Array.from({ length: 50 }, (_, i) => ({ playlistId: "p1", songId: `s${i}` }));
    const result = pushHistory(history, { playlistId: "p1", songId: "new" });
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual({ playlistId: "p1", songId: "s1" }); // s0 dropped
    expect(result[49]).toEqual({ playlistId: "p1", songId: "new" });
  });
});
