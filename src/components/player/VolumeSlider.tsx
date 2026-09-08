import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useLocale } from "@/i18n/LocaleContext";

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function VolumeSlider({ value, onChange }: VolumeSliderProps) {
  const { t } = useLocale();
  const Icon = value === 0 ? VolumeX : value < 50 ? Volume1 : Volume2;
  return (
    <div className="hidden md:flex items-center gap-2">
      <Icon size={14} className="text-text-dim" />
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[90px] accent-accent cursor-pointer"
        aria-label={t("player.volume")}
      />
    </div>
  );
}
