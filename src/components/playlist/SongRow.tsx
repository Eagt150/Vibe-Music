import { Heart, Pause, Play } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useLocale } from "@/i18n/LocaleContext";
import type { DragHandlers } from "@/hooks/useDragReorder";
import type { SongMeta } from "@/types";
import { SongRowMenu } from "./SongRowMenu";

interface SongRowProps {
  song: SongMeta;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onToggleFavorite: () => void;
  onPlayToggle: () => void;
  onMoveToPlaylist: () => void;
  onDelete: () => void;
  dragHandlers: DragHandlers;
}

export function SongRow({
  song,
  index,
  isCurrent,
  isPlaying,
  onToggleFavorite,
  onPlayToggle,
  onMoveToPlaylist,
  onDelete,
  dragHandlers,
}: SongRowProps) {
  const { t } = useLocale();
  return (
    <div
      {...dragHandlers}
      className={cn(
        "group flex items-center gap-2 px-2 py-2.5 rounded-md cursor-grab",
        isCurrent ? "bg-surface-alt" : "hover:bg-surface-alt/40"
      )}
    >
      <span className={cn("w-5 text-center text-sm flex-shrink-0", isCurrent ? "text-accent" : "text-text-faint")}>
        {index}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className={cn("text-md font-semibold truncate", isCurrent ? "text-accent" : "text-text")}>
          {song.title}
        </div>
        <div className="text-sm text-text-dim truncate">{song.artist}</div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn("flex-shrink-0 cursor-pointer", song.favorite ? "text-accent" : "text-text-faint")}
        aria-label={song.favorite ? t("song.unfavorite") : t("song.favorite")}
      >
        <Heart size={15} fill={song.favorite ? "currentColor" : "none"} />
      </button>
      <span className="text-sm text-text-faint min-w-10 text-right flex-shrink-0">{formatDuration(song.durationSec)}</span>
      <button
        type="button"
        onClick={onPlayToggle}
        className="flex-shrink-0 w-6 flex items-center justify-center text-text cursor-pointer"
        aria-label={isCurrent && isPlaying ? t("song.pause") : t("song.play")}
      >
        {isCurrent && isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
      </button>
      <SongRowMenu onMoveToPlaylist={onMoveToPlaylist} onDelete={onDelete} />
    </div>
  );
}
