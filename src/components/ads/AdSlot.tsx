import { X } from "lucide-react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";

/** Purely visual placeholder — no ad network is wired up. Never blocks
 * playback; the user can dismiss it and keep listening. */
export function AdSlot() {
  const { pendingAd, dismissAd } = useAudioPlayer();
  if (!pendingAd) return null;

  return (
    <div className="fixed bottom-[86px] md:bottom-[92px] left-1/2 -translate-x-1/2 z-30 bg-surface-alt border border-border rounded-md px-4 py-3 flex items-center gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <span className="text-sm text-text-dim">Advertisement — placeholder ad slot.</span>
      <button
        type="button"
        onClick={dismissAd}
        className="text-text-faint hover:text-text cursor-pointer"
        aria-label="Dismiss ad"
      >
        <X size={14} />
      </button>
    </div>
  );
}
