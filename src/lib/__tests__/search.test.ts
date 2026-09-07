import { describe, expect, it } from "vitest";
import { filterPlaylistsBySearch, filterSongsBySearch } from "../search";
import type { PlaylistMeta, SongMeta } from "@/types";

function playlist(id: string, name: string): PlaylistMeta {
  return { id, name, hue: 0, createdAt: 0, order: 0 };
}
function song(id: string, playlistId: string, title: string, artist: string): SongMeta {
  return { id, playlistId, title, artist, durationSec: 1, favorite: false, orderIndex: 0, mimeType: "audio/mpeg" };
}

describe("filterPlaylistsBySearch", () => {
  const playlists = [playlist("p1", "Chill Vibes"), playlist("p2", "Indie Mix")];
  const songsByPlaylist = {
    p1: [song("s1", "p1", "Soft Static", "Nova Reyes")],
    p2: [song("s2", "p2", "Screen Door", "Wilder Finch")],
  };

  it("returns everything for an empty query", () => {
    expect(filterPlaylistsBySearch(playlists, songsByPlaylist, "")).toHaveLength(2);
  });

  it("matches by playlist name", () => {
    const result = filterPlaylistsBySearch(playlists, songsByPlaylist, "indie");
    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });

  it("matches by a contained song's title or artist", () => {
    expect(filterPlaylistsBySearch(playlists, songsByPlaylist, "nova").map((p) => p.id)).toEqual(["p1"]);
    expect(filterPlaylistsBySearch(playlists, songsByPlaylist, "screen door").map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("filterSongsBySearch", () => {
  const songs = [song("s1", "p1", "Soft Static", "Nova Reyes"), song("s2", "p1", "Paper Clouds", "Kai Loom")];

  it("matches title or artist, case-insensitively", () => {
    expect(filterSongsBySearch(songs, "PAPER").map((s) => s.id)).toEqual(["s2"]);
    expect(filterSongsBySearch(songs, "kai").map((s) => s.id)).toEqual(["s2"]);
  });
});
