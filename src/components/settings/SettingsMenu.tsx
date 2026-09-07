import { useRef } from "react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import type { AdFrequency } from "@/types";

const OPTIONS: { value: AdFrequency; label: string }[] = [
  { value: "off", label: "Off" },
  { value: 1, label: "Every song" },
  { value: 5, label: "Every 5 songs" },
  { value: 10, label: "Every 10 songs" },
  { value: 20, label: "Every 20 songs" },
];

interface SettingsMenuProps {
  onClose: () => void;
}

/** A placeholder for a real ad network — no AdSense/AdsWizz integration is
 * wired up yet, this just persists the user's preferred frequency so the
 * gate logic in AudioPlayerContext has something to check against later. */
export function SettingsMenu({ onClose }: SettingsMenuProps) {
  const { adFrequency, setAdFrequency } = useAudioPlayer();
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, onClose);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[42px] z-30 bg-surface border border-border rounded-md p-3.5 w-56 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
    >
      <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">Ad frequency</div>
      <select
        value={adFrequency}
        onChange={(e) => {
          const raw = e.target.value;
          setAdFrequency(raw === "off" ? "off" : (Number(raw) as AdFrequency));
        }}
        className="w-full bg-input-bg border border-border rounded-sm px-2 py-1.5 text-base text-text outline-none"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
