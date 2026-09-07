import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createPlaylist as dbCreatePlaylist,
  deletePlaylist as dbDeletePlaylist,
  findOrCreateMyMusicPlaylist,
  getAllPlaylists,
  reorderPlaylists as dbReorderPlaylists,
  updatePlaylistCover,
  updatePlaylistName,
} from "@/lib/db/playlists";
import {
  deleteSong as dbDeleteSong,
  getSongsForPlaylist,
  reorderSongs as dbReorderSongs,
  updateSongFavorite,
} from "@/lib/db/songs";
import { importFilesToPlaylist, type ImportResult } from "@/lib/importFiles";
import { useAudioPlayer } from "./AudioPlayerContext";
import type { PlaylistMeta, SongMeta } from "@/types";

interface LibraryContextValue {
  playlists: PlaylistMeta[];
  songsByPlaylist: Record<string, SongMeta[]>;
  isLoading: boolean;
  createPlaylist: (name: string) => Promise<PlaylistMeta>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  setPlaylistCover: (id: string, file: File) => Promise<void>;
  toggleFavorite: (songId: string, playlistId: string) => Promise<void>;
  deleteSong: (songId: string, playlistId: string) => Promise<void>;
  reorderSongsInPlaylist: (playlistId: string, orderedSongIds: string[]) => Promise<void>;
  reorderPlaylists: (orderedIds: string[]) => Promise<void>;
  importFiles: (files: FileList | File[], targetPlaylistId?: string) => Promise<ImportResult & { playlistId: string }>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const audioPlayer = useAudioPlayer();
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>([]);
  const [songsByPlaylist, setSongsByPlaylist] = useState<Record<string, SongMeta[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  async function refreshPlaylists() {
    setPlaylists(await getAllPlaylists());
  }

  async function refreshSongs(playlistId: string) {
    const songs = await getSongsForPlaylist(playlistId);
    setSongsByPlaylist((current) => ({ ...current, [playlistId]: songs }));
  }

  useEffect(() => {
    void (async () => {
      const all = await getAllPlaylists();
      setPlaylists(all);
      const entries = await Promise.all(all.map(async (p) => [p.id, await getSongsForPlaylist(p.id)] as const));
      setSongsByPlaylist(Object.fromEntries(entries));
      setIsLoading(false);
    })();
  }, []);

  async function createPlaylist(name: string) {
    const record = await dbCreatePlaylist(name);
    await refreshPlaylists();
    setSongsByPlaylist((current) => ({ ...current, [record.id]: [] }));
    return record;
  }

  async function renamePlaylist(id: string, name: string) {
    await updatePlaylistName(id, name);
    await refreshPlaylists();
  }

  async function deletePlaylist(id: string) {
    await dbDeletePlaylist(id);
    audioPlayer.pruneReferences(id);
    await refreshPlaylists();
    setSongsByPlaylist((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }

  async function setPlaylistCover(id: string, file: File) {
    await updatePlaylistCover(id, file);
    await refreshPlaylists();
  }

  async function toggleFavorite(songId: string, playlistId: string) {
    const current = songsByPlaylist[playlistId]?.find((s) => s.id === songId);
    await updateSongFavorite(songId, !(current?.favorite ?? false));
    await refreshSongs(playlistId);
  }

  async function deleteSong(songId: string, playlistId: string) {
    await dbDeleteSong(songId);
    audioPlayer.pruneReferences(playlistId, songId);
    await refreshSongs(playlistId);
    await refreshPlaylists(); // song counts shown on playlist cards change
  }

  async function reorderSongsInPlaylist(playlistId: string, orderedSongIds: string[]) {
    await dbReorderSongs(playlistId, orderedSongIds);
    await refreshSongs(playlistId);
  }

  async function reorderPlaylists(orderedIds: string[]) {
    await dbReorderPlaylists(orderedIds);
    await refreshPlaylists();
  }

  async function importFiles(fileList: FileList | File[], targetPlaylistId?: string) {
    const files = Array.from(fileList);
    const playlist = targetPlaylistId ? playlists.find((p) => p.id === targetPlaylistId) : undefined;
    const targetId = playlist ? playlist.id : (await findOrCreateMyMusicPlaylist()).id;

    const result = await importFilesToPlaylist(targetId, files);

    await refreshPlaylists();
    await refreshSongs(targetId);

    return { ...result, playlistId: targetId };
  }

  const value: LibraryContextValue = {
    playlists,
    songsByPlaylist,
    isLoading,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    setPlaylistCover,
    toggleFavorite,
    deleteSong,
    reorderSongsInPlaylist,
    reorderPlaylists,
    importFiles,
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within a LibraryProvider");
  return ctx;
}
