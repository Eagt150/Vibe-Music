import type { PlaylistMeta, SongMeta } from "@/types";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Home search: matches a playlist by its own name, or by any song it
 * contains (title or artist). */
export function filterPlaylistsBySearch(
  playlists: PlaylistMeta[],
  songsByPlaylist: Record<string, SongMeta[]>,
  query: string
): PlaylistMeta[] {
  const q = norm(query);
  if (!q) return playlists;
  return playlists.filter((p) => {
    if (norm(p.name).includes(q)) return true;
    const songs = songsByPlaylist[p.id] ?? [];
    return songs.some((s) => norm(s.title).includes(q) || norm(s.artist).includes(q));
  });
}

/** Playlist-detail search: matches songs within that one playlist. */
export function filterSongsBySearch(songs: SongMeta[], query: string): SongMeta[] {
  const q = norm(query);
  if (!q) return songs;
  return songs.filter((s) => norm(s.title).includes(q) || norm(s.artist).includes(q));
}
