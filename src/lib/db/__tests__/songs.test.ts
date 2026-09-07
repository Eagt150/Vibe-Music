import { beforeEach, describe, expect, it } from "vitest";
import { makeBlob, resetFakeIndexedDB } from "./testUtils";
import { createPlaylist } from "../playlists";
import {
  addSong,
  addSongs,
  deleteSong,
  getAudioBlob,
  getSongsForPlaylist,
  reorderSongs,
  updateSongFavorite,
} from "../songs";
import { getCover } from "../covers";

beforeEach(() => {
  resetFakeIndexedDB();
});

describe("songs", () => {
  it("stores metadata and audio blob separately, both retrievable", async () => {
    const playlist = await createPlaylist("P");
    const song = await addSong(playlist.id, {
      title: "Soft Static",
      artist: "Nova Reyes",
      durationSec: 192,
      audioBlob: makeBlob("bytes-1"),
      mimeType: "audio/mpeg",
    });

    const songs = await getSongsForPlaylist(playlist.id);
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe("Soft Static");
    expect((songs[0] as unknown as { audioBlob?: unknown }).audioBlob).toBeUndefined();

    const blob = await getAudioBlob(song.id);
    expect(await blob?.text()).toBe("bytes-1");
  });

  it("dedupes an embedded cover shared across an album's tracks", async () => {
    const playlist = await createPlaylist("Album");
    const sameCover = makeBlob("shared-cover", "image/png");

    const s1 = await addSong(playlist.id, {
      title: "Track 1",
      artist: "Band",
      durationSec: 200,
      audioBlob: makeBlob("a1"),
      mimeType: "audio/mpeg",
      embeddedCoverBlob: sameCover,
    });
    const s2 = await addSong(playlist.id, {
      title: "Track 2",
      artist: "Band",
      durationSec: 210,
      audioBlob: makeBlob("a2"),
      mimeType: "audio/mpeg",
      embeddedCoverBlob: sameCover,
    });

    expect(s1.embeddedCoverHash).toBe(s2.embeddedCoverHash);

    // Only one cover record should exist for both — deleting one song must
    // not remove the cover the other song still references.
    await deleteSong(s1.id);
    expect(await getCover(s2.embeddedCoverHash!)).toBeDefined();

    await deleteSong(s2.id);
    expect(await getCover(s2.embeddedCoverHash!)).toBeUndefined();
  });

  it("addSongs assigns sequential orderIndex within one transaction", async () => {
    const playlist = await createPlaylist("Batch");
    const inputs = ["A", "B", "C"].map((title) => ({
      title,
      artist: "Artist",
      durationSec: 100,
      audioBlob: makeBlob(title),
      mimeType: "audio/mpeg",
    }));
    const created = await addSongs(playlist.id, inputs);
    expect(created.map((s) => s.orderIndex)).toEqual([0, 1, 2]);

    const songs = await getSongsForPlaylist(playlist.id);
    expect(songs.map((s) => s.title)).toEqual(["A", "B", "C"]);
  });

  it("reorders songs and getSongsForPlaylist reflects the new order", async () => {
    const playlist = await createPlaylist("Reorder");
    const [a, b, c] = await addSongs(playlist.id, [
      { title: "A", artist: "x", durationSec: 1, audioBlob: makeBlob("a"), mimeType: "audio/mpeg" },
      { title: "B", artist: "x", durationSec: 1, audioBlob: makeBlob("b"), mimeType: "audio/mpeg" },
      { title: "C", artist: "x", durationSec: 1, audioBlob: makeBlob("c"), mimeType: "audio/mpeg" },
    ]);

    await reorderSongs(playlist.id, [c.id, a.id, b.id]);
    const songs = await getSongsForPlaylist(playlist.id);
    expect(songs.map((s) => s.title)).toEqual(["C", "A", "B"]);
  });

  it("toggles favorite", async () => {
    const playlist = await createPlaylist("Favs");
    const song = await addSong(playlist.id, {
      title: "T",
      artist: "A",
      durationSec: 1,
      audioBlob: makeBlob("x"),
      mimeType: "audio/mpeg",
    });
    await updateSongFavorite(song.id, true);
    const [reloaded] = await getSongsForPlaylist(playlist.id);
    expect(reloaded.favorite).toBe(true);
  });
});
