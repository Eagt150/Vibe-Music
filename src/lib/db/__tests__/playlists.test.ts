import { beforeEach, describe, expect, it } from "vitest";
import { resetFakeIndexedDB } from "./testUtils";
import {
  createPlaylist,
  deletePlaylist,
  findOrCreateMyMusicPlaylist,
  getAllPlaylists,
  reorderPlaylists,
  updatePlaylistName,
} from "../playlists";
import { addSong } from "../songs";
import { getAudioBlob } from "../songs";
import { getCover } from "../covers";
import { makeBlob } from "./testUtils";

beforeEach(() => {
  resetFakeIndexedDB();
});

describe("playlists", () => {
  it("creates playlists with incrementing order", async () => {
    const a = await createPlaylist("Chill Vibes");
    const b = await createPlaylist("Indie Mix");
    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
    const all = await getAllPlaylists();
    expect(all.map((p) => p.name)).toEqual(["Chill Vibes", "Indie Mix"]);
  });

  it("renames a playlist", async () => {
    const p = await createPlaylist("Old Name");
    await updatePlaylistName(p.id, "New Name");
    const all = await getAllPlaylists();
    expect(all[0].name).toBe("New Name");
  });

  it("reuses the same 'My Music' playlist across imports", async () => {
    const first = await findOrCreateMyMusicPlaylist();
    const second = await findOrCreateMyMusicPlaylist();
    expect(first.id).toBe(second.id);
    const all = await getAllPlaylists();
    expect(all.filter((p) => p.name === "My Music")).toHaveLength(1);
  });

  it("reorders playlists", async () => {
    const a = await createPlaylist("A");
    const b = await createPlaylist("B");
    const c = await createPlaylist("C");
    await reorderPlaylists([c.id, a.id, b.id]);
    const all = await getAllPlaylists();
    expect(all.map((p) => p.name)).toEqual(["C", "A", "B"]);
  });

  it("cascades delete: removes songs, audio blobs, and releases the cover", async () => {
    const playlist = await createPlaylist("To Delete");
    const cover = makeBlob("cover-bytes", "image/png");
    const song = await addSong(playlist.id, {
      title: "Track 1",
      artist: "Artist",
      durationSec: 120,
      audioBlob: makeBlob("audio-bytes"),
      mimeType: "audio/mpeg",
      embeddedCoverBlob: cover,
    });

    expect(song.embeddedCoverHash).toBeDefined();
    expect(await getCover(song.embeddedCoverHash!)).toBeDefined();

    await deletePlaylist(playlist.id);

    expect(await getAllPlaylists()).toHaveLength(0);
    expect(await getAudioBlob(song.id)).toBeUndefined();
    expect(await getCover(song.embeddedCoverHash!)).toBeUndefined();
  });
});
