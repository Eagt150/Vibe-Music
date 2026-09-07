import type { KeyboardEvent, MouseEvent } from "react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ProgressBarProps {
  currentSec: number;
  durationSec: number;
  onSeekRatio: (ratio: number) => void;
  onSeekSeconds: (sec: number) => void;
  size?: "sm" | "lg";
}

export function ProgressBar({ currentSec, durationSec, onSeekRatio, onSeekSeconds, size = "sm" }: ProgressBarProps) {
  const pct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeekRatio(ratio);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") onSeekSeconds(Math.min(durationSec, currentSec + 5));
    if (e.key === "ArrowLeft") onSeekSeconds(Math.max(0, currentSec - 5));
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-sm text-text-faint w-8 text-center flex-shrink-0">{formatDuration(currentSec)}</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={durationSec}
        aria-valuenow={currentSec}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex-1 bg-surface-alt rounded-pill overflow-hidden cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent",
          size === "lg" ? "h-[6px]" : "h-[5px]"
        )}
      >
        <div className="h-full bg-accent rounded-pill" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-text-faint w-8 text-center flex-shrink-0">{formatDuration(durationSec)}</span>
    </div>
  );
}
