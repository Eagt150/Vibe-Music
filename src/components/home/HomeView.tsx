import { useRef, useState, type DragEvent } from "react";
import { Plus, Upload } from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useUiState } from "@/context/UiStateContext";
import { useLocale } from "@/i18n/LocaleContext";
import { useDuplicateConfirm } from "@/hooks/useDuplicateConfirm";
import { filterPlaylistsBySearch } from "@/lib/search";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { DuplicateConfirmDialog } from "@/components/ui/DuplicateConfirmDialog";
import { PlaylistGrid } from "./PlaylistGrid";
import { RecentlyPlayedRow } from "./RecentlyPlayedRow";

export function HomeView() {
  const { playlists, songsByPlaylist, importFiles } = useLibrary();
  const { recentlyPlayed, playSong } = useAudioPlayer();
  const { searchQuery, navigateToPlaylist, setImportError, setImportProgress } = useUiState();
  const { t } = useLocale();
  const { pending, onDuplicate, respond } = useDuplicateConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const visiblePlaylists = filterPlaylistsBySearch(playlists, songsByPlaylist, searchQuery);
  const showNoResults = searchQuery.trim() !== "" && visiblePlaylists.length === 0;

  async function handleFiles(files: FileList | File[]) {
    setImportProgress({ completed: 0, total: files.length });
    const result = await importFiles(
      files,
      undefined,
      (completed, total) => setImportProgress({ completed, total }),
      onDuplicate,
      t("importFlow.unknownArtist")
    );
    setImportProgress(null);
    // Importing navigates to the target playlist right after — this state
    // lives in UiStateContext (not local state) specifically so the banner
    // survives that navigation instead of vanishing with this component.
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
    navigateToPlaylist(result.playlistId);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("audio/"));
    if (files.length > 0) void handleFiles(files);
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

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5.5">
        <h1 className="text-[22px] md:text-2xl font-extrabold tracking-tight">{t("home.title")}</h1>
        <Button icon={<Plus size={14} />} onClick={() => fileInputRef.current?.click()}>
          {t("home.importMusic")}
        </Button>
        <HiddenFileInput ref={fileInputRef} accept="audio/*" multiple onFiles={handleFiles} />
      </div>

      <div className="text-base font-bold text-text-dim uppercase tracking-wide mb-3.5">{t("home.yourPlaylists")}</div>

      {showNoResults ? (
        <EmptyState title={t("home.noMatches")} subtitle={t("home.tryDifferentSearch")} />
      ) : (
        <PlaylistGrid playlists={visiblePlaylists} songsByPlaylist={songsByPlaylist} onOpen={navigateToPlaylist} />
      )}

      {!searchQuery && (
        <RecentlyPlayedRow
          entries={recentlyPlayed}
          playlists={playlists}
          songsByPlaylist={songsByPlaylist}
          onPlay={playSong}
        />
      )}

      <DuplicateConfirmDialog info={pending} onRespond={respond} />
    </div>
  );
}
