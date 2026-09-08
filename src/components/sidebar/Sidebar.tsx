import { useState } from "react";
import { Home as HomeIcon, Plus, X } from "lucide-react";
import { useLibrary } from "@/context/LibraryContext";
import { useUiState } from "@/context/UiStateContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useLocale } from "@/i18n/LocaleContext";
import { cn } from "@/lib/cn";
import { CreatePlaylistInlineForm } from "./CreatePlaylistInlineForm";
import { SidebarPlaylistItem } from "./SidebarPlaylistItem";

export function Sidebar() {
  const { playlists, songsByPlaylist, createPlaylist } = useLibrary();
  const { route, navigateHome, navigateToPlaylist, isMobileSidebarOpen, closeMobileSidebar } = useUiState();
  const isMobile = useIsMobile();
  const { t } = useLocale();
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate(name: string) {
    const playlist = await createPlaylist(name);
    setIsCreating(false);
    navigateToPlaylist(playlist.id);
  }

  const body = (
    <div className="flex flex-col h-full w-60 bg-surface border-r border-border p-3.5 gap-1 overflow-y-auto box-border">
      <div className="flex items-center justify-between gap-2 px-2.5 pb-4.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0" />
          <span className="font-extrabold text-lg tracking-tight">Vibe Music</span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="text-text-dim cursor-pointer p-1"
            aria-label={t("sidebar.closeMenu")}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={navigateHome}
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-base font-semibold cursor-pointer text-left",
          route.type === "home" ? "bg-surface-alt text-accent" : "text-text hover:bg-surface-alt/50"
        )}
      >
        <HomeIcon size={14} />
        <span>{t("sidebar.home")}</span>
      </button>

      <div className="flex items-center justify-between px-2.5 pt-4.5 pb-1.5">
        <span className="text-sm font-bold tracking-wide text-text-faint uppercase">{t("sidebar.myPlaylists")}</span>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="text-text-dim hover:text-text cursor-pointer p-1"
          title={t("sidebar.newPlaylist")}
          aria-label={t("sidebar.newPlaylist")}
        >
          <Plus size={14} />
        </button>
      </div>

      {isCreating && (
        <CreatePlaylistInlineForm onConfirm={handleCreate} onCancel={() => setIsCreating(false)} />
      )}

      <div className="flex flex-col gap-0.5">
        {playlists.map((p) => (
          <SidebarPlaylistItem
            key={p.id}
            playlist={p}
            songCount={songsByPlaylist[p.id]?.length ?? 0}
            active={route.type === "playlist" && route.playlistId === p.id}
            onClick={() => navigateToPlaylist(p.id)}
          />
        ))}
      </div>
    </div>
  );

  if (!isMobile) return body;

  return (
    <>
      {isMobileSidebarOpen && <div className="fixed inset-0 bg-overlay z-40" onClick={closeMobileSidebar} />}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 sidebar-drawer shadow-[4px_0_24px_rgba(0,0,0,0.3)]",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {body}
      </div>
    </>
  );
}
