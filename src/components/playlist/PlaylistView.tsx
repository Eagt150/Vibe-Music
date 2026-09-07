import { useRef } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useUiState } from "@/context/UiStateContext";
import { filterSongsBySearch } from "@/lib/search";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistHeader } from "./PlaylistHeader";
import { PlaylistEmptyState } from "./PlaylistEmptyState";
import { SongList } from "./SongList";

interface PlaylistViewProps {
  playlistId: string;
}

export function PlaylistView({ playlistId }: PlaylistViewProps) {
  const { playlists, songsByPlaylist, renamePlaylist, setPlaylistCover, toggleFavorite, reorderSongsInPlaylist, importFiles } =
    useLibrary();
  const { playingSongId, isPlaying, playPlaylist, shufflePlaylist, playSong, togglePlayPause } = useAudioPlayer();
  const { searchQuery, setImportError } = useUiState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const playlist = playlists.find((p) => p.id === playlistId);
  const songs = songsByPlaylist[playlistId] ?? [];

  // Playlist was deleted while this view was open (e.g. from another tab) —
  // App.tsx's route-guard effect will navigate back to Home shortly.
  if (!playlist) return null;

  const visibleSongs = filterSongsBySearch(songs, searchQuery);
  const showEmpty = songs.length === 0;
  const showNoResults = !showEmpty && searchQuery.trim() !== "" && visibleSongs.length === 0;

  async function handleFiles(files: FileList) {
    const result = await importFiles(files, playlistId);
    if (result.failures.length > 0) {
      setImportError(
        `${result.failures.length} file(s) couldn't be imported: ${result.failures.map((f) => f.fileName).join(", ")}`
      );
    } else if (result.quotaWarning) {
      setImportError("Storage is getting full — consider removing some songs.");
    } else {
      setImportError(null);
    }
  }

  function handlePlaySong(songId: string) {
    if (songId === playingSongId) togglePlayPause();
    else void playSong(playlistId, songId);
  }

  return (
    <div className="p-4 md:p-8 pb-10">
      <PlaylistHeader
        playlist={playlist}
        songCount={songs.length}
        songTitles={songs.map((s) => s.title)}
        onRename={(name) => void renamePlaylist(playlistId, name)}
        onCoverUpload={(file) => void setPlaylistCover(playlistId, file)}
        onPlay={() => void playPlaylist(playlistId)}
        onShuffle={() => void shufflePlaylist(playlistId)}
        onAddSongsClick={() => fileInputRef.current?.click()}
      />
      <HiddenFileInput ref={fileInputRef} accept="audio/*" multiple onFiles={handleFiles} />

      {showEmpty && <PlaylistEmptyState onAddSongsClick={() => fileInputRef.current?.click()} />}
      {showNoResults && <EmptyState title="No matches" subtitle="Try a different search." />}
      {!showEmpty && !showNoResults && (
        <SongList
          songs={visibleSongs}
          playingSongId={playingSongId}
          isPlaying={isPlaying}
          onToggleFavorite={(songId) => void toggleFavorite(songId, playlistId)}
          onPlaySong={handlePlaySong}
          onReorder={(orderedIds) => void reorderSongsInPlaylist(playlistId, orderedIds)}
        />
      )}
    </div>
  );
}
