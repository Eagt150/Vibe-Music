import { CoverArt } from "@/components/ui/CoverArt";
import type { PlaylistMeta } from "@/types";

interface PlaylistCardProps {
  playlist: PlaylistMeta;
  songCount: number;
  songTitles: string[];
  onClick: () => void;
}

export function PlaylistCard({ playlist, songCount, songTitles, onClick }: PlaylistCardProps) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col gap-2 text-left cursor-pointer w-full">
      <CoverArt coverHash={playlist.coverHash} songTitles={songTitles} hue={playlist.hue} size="md" />
      <div className="text-base font-bold truncate">{playlist.name}</div>
      <div className="text-sm text-text-dim">{songCount} songs</div>
    </button>
  );
}
