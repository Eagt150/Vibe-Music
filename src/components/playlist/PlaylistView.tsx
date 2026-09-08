import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useUiState } from "@/context/UiStateContext";
import { useLocale } from "@/i18n/LocaleContext";
import { useDuplicateConfirm } from "@/hooks/useDuplicateConfirm";
import { filterSongsBySearch } from "@/lib/search";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DuplicateConfirmDialog } from "@/components/ui/DuplicateConfirmDialog";
import { MoveToPlaylistDialog } from "@/components/ui/MoveToPlaylistDialog";
import { PlaylistHeader } from "./PlaylistHeader";
import { PlaylistEmptyState } from "./PlaylistEmptyState";
import { SongList } from "./SongList";

interface PlaylistViewProps {
  playlistId: string;
}

export function PlaylistView({ playlistId }: PlaylistViewProps) {
  const {
    playlists,
    songsByPlaylist,
    renamePlaylist,
    setPlaylistCover,
    toggleFavorite,
    reorderSongsInPlaylist,
    importFiles,
    deletePlaylist,
    deleteSong,
    moveSongToPlaylist,
  } = useLibrary();
  const { playingSongId, isPlaying, playPlaylist, shufflePlaylist, playSong, togglePlayPause } = useAudioPlayer();
  const { searchQuery, setImportError, setImportProgress, navigateHome } = useUiState();
  const { t } = useLocale();
  const { pending, onDuplicate, respond } = useDuplicateConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [deletingPlaylist, setDeletingPlaylist] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [movingSongId, setMovingSongId] = useState<string | null>(null);

  const playlist = playlists.find((p) => p.id === playlistId);
  const songs = songsByPlaylist[playlistId] ?? [];

  // Playlist was deleted while this view was open (e.g. from another tab) —
  // App.tsx's route-guard effect will navigate back to Home shortly.
  if (!playlist) return null;

  const visibleSongs = filterSongsBySearch(songs, searchQuery);
  const showEmpty = songs.length === 0;
  const showNoResults = !showEmpty && searchQuery.trim() !== "" && visibleSongs.length === 0;
  const deletingSong = songs.find((s) => s.id === deletingSongId);

  async function handleFiles(files: FileList | File[]) {
    setImportProgress({ completed: 0, total: files.length });
    const result = await importFiles(
      files,
      playlistId,
      (completed, total) => setImportProgress({ completed, total }),
      onDuplicate,
      t("importFlow.unknownArtist")
    );
    setImportProgress(null);
    if (result.failures.length > 0) {
      setImportError(
        t("importFlow.failuresBanner", {
          count: result.failures.length,
          names: result.failures.map((f) => f.fileName).join(", "),
        })
      );
    } else if (result.quotaWarning) {
      setImportError(t("importFlow.quotaWarning"));
    } else {
      setImportError(null);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/"));
    if (files.length > 0) void handleFiles(files);
  }

  function handlePlaySong(songId: string) {
    if (songId === playingSongId) togglePlayPause();
    else void playSong(playlistId, songId);
  }

  return (
    <div
      className="p-4 md:p-8 pb-10 relative min-h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-2 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10 pointer-events-none">
          <div className="flex items-center gap-2 text-md font-bold text-accent">
            <Upload size={18} />
            {t("playlist.dropHint")}
          </div>
        </div>
      )}

      <PlaylistHeader
        playlist={playlist}
        songCount={songs.length}
        songTitles={songs.map((s) => s.title)}
        onRename={(name) => void renamePlaylist(playlistId, name)}
        onCoverUpload={(file) => void setPlaylistCover(playlistId, file)}
        onPlay={() => void playPlaylist(playlistId)}
        onShuffle={() => void shufflePlaylist(playlistId)}
        onAddSongsClick={() => fileInputRef.current?.click()}
        onDeleteClick={() => setDeletingPlaylist(true)}
      />
      <HiddenFileInput ref={fileInputRef} accept="audio/*" multiple onFiles={handleFiles} />

      {showEmpty && <PlaylistEmptyState onAddSongsClick={() => fileInputRef.current?.click()} />}
      {showNoResults && <EmptyState title={t("home.noMatches")} subtitle={t("home.tryDifferentSearch")} />}
      {!showEmpty && !showNoResults && (
        <SongList
          songs={visibleSongs}
          playingSongId={playingSongId}
          isPlaying={isPlaying}
          onToggleFavorite={(songId) => void toggleFavorite(songId, playlistId)}
          onPlaySong={handlePlaySong}
          onReorder={(orderedIds) => void reorderSongsInPlaylist(playlistId, orderedIds)}
          onMoveToPlaylist={setMovingSongId}
          onDelete={setDeletingSongId}
        />
      )}

      <DuplicateConfirmDialog info={pending} onRespond={respond} />

      {deletingPlaylist && (
        <ConfirmDialog
          title={t("playlist.deleteConfirmTitle", { name: playlist.name })}
          body={t("playlist.deleteConfirmBody")}
          confirmLabel={t("common.delete")}
          danger
          onCancel={() => setDeletingPlaylist(false)}
          onConfirm={() => {
            setDeletingPlaylist(false);
            void deletePlaylist(playlistId).then(navigateHome);
          }}
        />
      )}

      {deletingSong && (
        <ConfirmDialog
          title={t("song.deleteConfirmTitle", { title: deletingSong.title })}
          body={t("song.deleteConfirmBody")}
          confirmLabel={t("common.delete")}
          danger
          onCancel={() => setDeletingSongId(null)}
          onConfirm={() => {
            void deleteSong(deletingSong.id, playlistId);
            setDeletingSongId(null);
          }}
        />
      )}

      {movingSongId && (
        <MoveToPlaylistDialog
          playlists={playlists}
          excludePlaylistId={playlistId}
          onClose={() => setMovingSongId(null)}
          onSelect={(targetId) => {
            void moveSongToPlaylist(movingSongId, playlistId, targetId);
            setMovingSongId(null);
          }}
        />
      )}
    </div>
  );
}
