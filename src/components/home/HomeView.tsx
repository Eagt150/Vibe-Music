import { useRef } from "react";
import { Plus } from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useUiState } from "@/context/UiStateContext";
import { filterPlaylistsBySearch } from "@/lib/search";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { PlaylistGrid } from "./PlaylistGrid";
import { RecentlyPlayedRow } from "./RecentlyPlayedRow";

export function HomeView() {
  const { playlists, songsByPlaylist, importFiles } = useLibrary();
  const { recentlyPlayed, playSong } = useAudioPlayer();
  const { searchQuery, navigateToPlaylist, setImportError } = useUiState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visiblePlaylists = filterPlaylistsBySearch(playlists, songsByPlaylist, searchQuery);
  const showNoResults = searchQuery.trim() !== "" && visiblePlaylists.length === 0;

  async function handleFiles(files: FileList) {
    const result = await importFiles(files);
    // Importing navigates to the target playlist right after — this state
    // lives in UiStateContext (not local state) specifically so the banner
    // survives that navigation instead of vanishing with this component.
    if (result.failures.length > 0) {
      setImportError(
        `${result.failures.length} file(s) couldn't be imported: ${result.failures.map((f) => f.fileName).join(", ")}`
      );
    } else if (result.quotaWarning) {
      setImportError("Storage is getting full — consider removing some songs.");
    } else {
      setImportError(null);
    }
    navigateToPlaylist(result.playlistId);
  }

  return (
    <div className="p-4 md:p-8 pb-10">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5.5">
        <h1 className="text-[22px] md:text-2xl font-extrabold tracking-tight">Home</h1>
        <Button icon={<Plus size={14} />} onClick={() => fileInputRef.current?.click()}>
          Import Music
        </Button>
        <HiddenFileInput ref={fileInputRef} accept="audio/*" multiple onFiles={handleFiles} />
      </div>

      <div className="text-base font-bold text-text-dim uppercase tracking-wide mb-3.5">Your Playlists</div>

      {showNoResults ? (
        <EmptyState title="No matches" subtitle="Try a different search." />
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
    </div>
  );
}
