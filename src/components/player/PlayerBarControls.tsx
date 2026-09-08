import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useLocale } from "@/i18n/LocaleContext";
import { cn } from "@/lib/cn";

interface PlayerBarControlsProps {
  size?: "sm" | "lg";
}

export function PlayerBarControls({ size = "sm" }: PlayerBarControlsProps) {
  const { t } = useLocale();
  const { isPlaying, shuffle, repeatMode, toggleShuffle, prev, togglePlayPause, next, cycleRepeat } = useAudioPlayer();
  const big = size === "lg";
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    <div className={cn("flex items-center", big ? "gap-6" : "gap-4")}>
      <IconButton active={shuffle} onClick={toggleShuffle} size={big ? 30 : 26} aria-label={t("player.shuffle")}>
        <Shuffle size={big ? 16 : 13} />
      </IconButton>
      <button type="button" onClick={() => void prev()} className="text-text cursor-pointer" aria-label={t("player.previous")}>
        <SkipBack size={big ? 22 : 16} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={togglePlayPause}
        className={cn(
          "bg-accent text-accent-text rounded-full flex items-center justify-center cursor-pointer flex-shrink-0",
          big ? "w-14 h-14" : "w-8 h-8"
        )}
        aria-label={isPlaying ? t("song.pause") : t("song.play")}
      >
        {isPlaying ? (
          <Pause size={big ? 22 : 13} fill="currentColor" />
        ) : (
          <Play size={big ? 20 : 13} fill="currentColor" className="ml-0.5" />
        )}
      </button>
      <button type="button" onClick={() => void next()} className="text-text cursor-pointer" aria-label={t("player.next")}>
        <SkipForward size={big ? 22 : 16} fill="currentColor" />
      </button>
      <IconButton active={repeatMode !== "off"} onClick={cycleRepeat} size={big ? 30 : 26} aria-label={t("player.repeat")}>
        <RepeatIcon size={big ? 16 : 13} />
      </IconButton>
    </div>
  );
}
