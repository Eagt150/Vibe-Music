import { useEffect } from "react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

const SEEK_STEP_SEC = 5;
const VOLUME_STEP = 5;

/** Space = play/pause, Left/Right = seek, Ctrl/Cmd+Left/Right = prev/next
 * track, Up/Down = volume. Disabled while typing in a text field, and
 * no-ops entirely when nothing is loaded. */
export function useKeyboardShortcuts() {
  const { playingSongId, isPlaying, progressSec, durationSec, volumeLevel, togglePlayPause, seek, setVolume, next, prev } =
    useAudioPlayer();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || !playingSongId) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) void next();
          else seek(Math.min(durationSec, progressSec + SEEK_STEP_SEC));
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) void prev();
          else seek(Math.max(0, progressSec - SEEK_STEP_SEC));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(100, volumeLevel + VOLUME_STEP));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volumeLevel - VOLUME_STEP));
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playingSongId, isPlaying, progressSec, durationSec, volumeLevel, togglePlayPause, seek, setVolume, next, prev]);
}
