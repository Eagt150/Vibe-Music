import { useEffect } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { useUiState } from "@/context/UiStateContext";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { HomeView } from "@/components/home/HomeView";
import { PlaylistView } from "@/components/playlist/PlaylistView";
import { PlayerBar } from "@/components/player/PlayerBar";
import { FullScreenPlayer } from "@/components/player/FullScreenPlayer";
import { QueuePanel } from "@/components/player/QueuePanel";
import { AdSlot } from "@/components/ads/AdSlot";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { playlists, isLoading } = useLibrary();
  const { route, navigateHome, importError, setImportError } = useUiState();

  // If the currently viewed playlist gets deleted, bounce back to Home
  // instead of rendering a stale/blank playlist view.
  useEffect(() => {
    if (isLoading) return;
    if (route.type === "playlist" && !playlists.some((p) => p.id === route.playlistId)) {
      navigateHome();
    }
  }, [isLoading, playlists, route, navigateHome]);

  return (
    <div className="flex flex-col w-full h-screen bg-bg text-text overflow-hidden relative">
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto">
            {importError && (
              <div className="px-4 md:px-8 pt-4">
                <ErrorBanner message={importError} onDismiss={() => setImportError(null)} />
              </div>
            )}
            {route.type === "home" ? <HomeView /> : <PlaylistView playlistId={route.playlistId} />}
          </div>
        </div>
      </div>
      <PlayerBar />
      <FullScreenPlayer />
      <QueuePanel />
      <AdSlot />
    </div>
  );
}
