import { CoverArt } from "@/components/ui/CoverArt";
import { cn } from "@/lib/cn";
import type { PlaylistMeta } from "@/types";

interface SidebarPlaylistItemProps {
  playlist: PlaylistMeta;
  songCount: number;
  active: boolean;
  onClick: () => void;
}

export function SidebarPlaylistItem({ playlist, songCount, active, onClick }: SidebarPlaylistItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer text-left w-full",
        active ? "bg-surface-alt" : "hover:bg-surface-alt/50"
      )}
    >
      <CoverArt coverHash={playlist.coverHash} songTitles={[]} hue={playlist.hue} size="sm" />
      <span className="flex-1 min-w-0 text-base font-medium truncate">{playlist.name}</span>
      <span className="text-sm text-text-faint font-medium">{songCount}</span>
    </button>
  );
}
