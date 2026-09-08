import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useLibrary } from "@/context/LibraryContext";
import { useLocale } from "@/i18n/LocaleContext";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { useStorageEstimate } from "@/hooks/useStorageEstimate";
import { formatBytes, formatCountdown } from "@/lib/format";
import { downloadBlob, exportLibraryAsZip } from "@/lib/exportLibrary";
import { PLAYBACK_RATES, type AdFrequency, type Locale, type SleepTimerOption } from "@/types";

interface SettingsMenuProps {
  onClose: () => void;
}

const AD_FREQUENCIES: AdFrequency[] = ["off", 1, 5, 10, 20];
const SLEEP_OPTIONS: SleepTimerOption[] = ["off", 15, 30, 60, "end-of-track"];

export function SettingsMenu({ onClose }: SettingsMenuProps) {
  const { adFrequency, setAdFrequency, playbackRate, setPlaybackRate, sleepTimerOption, sleepTimerEndsAt, setSleepTimer } =
    useAudioPlayer();
  const { locale, setLocale, t } = useLocale();
  const { playlists } = useLibrary();
  const ref = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const storage = useStorageEstimate(playlists.length);
  useOnClickOutside(ref, onClose);

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, sleepTimerEndsAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt]);

  async function handleExport() {
    setIsExporting(true);
    try {
      const blob = await exportLibraryAsZip();
      downloadBlob(blob, `vibe-music-backup-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setIsExporting(false);
    }
  }

  function adFrequencyLabel(freq: AdFrequency): string {
    if (freq === "off") return t("settings.adFreqOff");
    if (freq === 1) return t("settings.adFreqEverySong");
    return t("settings.adFreqEveryN", { n: freq });
  }

  function sleepLabel(option: SleepTimerOption): string {
    if (option === "off") return t("settings.sleepTimerOff");
    if (option === "end-of-track") return t("settings.sleepTimerEndOfTrack");
    return t("settings.sleepTimerMinutes", { n: option });
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[42px] z-30 bg-surface border border-border rounded-md p-3.5 w-72 max-h-[80vh] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col gap-4"
    >
      <div>
        <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">{t("settings.language")}</div>
        <div className="flex gap-2">
          {(["en", "es"] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`flex-1 rounded-pill px-3 py-1.5 text-sm font-semibold cursor-pointer border ${
                locale === l ? "bg-accent text-accent-text border-transparent" : "bg-transparent text-text border-border"
              }`}
            >
              {l === "en" ? t("settings.languageEnglish") : t("settings.languageSpanish")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">{t("settings.playbackSpeed")}</div>
        <select
          value={playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          className="w-full bg-input-bg border border-border rounded-sm px-2 py-1.5 text-base text-text outline-none"
        >
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">{t("settings.sleepTimer")}</div>
        <select
          value={sleepTimerOption}
          onChange={(e) => {
            const raw = e.target.value;
            const value: SleepTimerOption =
              raw === "off" || raw === "end-of-track" ? raw : (Number(raw) as SleepTimerOption);
            setSleepTimer(value);
          }}
          className="w-full bg-input-bg border border-border rounded-sm px-2 py-1.5 text-base text-text outline-none"
        >
          {SLEEP_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {sleepLabel(opt)}
            </option>
          ))}
        </select>
        {remainingMs !== null && (
          <div className="text-sm text-text-dim mt-1.5">
            {t("settings.sleepTimerActive", { time: formatCountdown(remainingMs) })}
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">{t("settings.adFrequency")}</div>
        <select
          value={adFrequency}
          onChange={(e) => {
            const raw = e.target.value;
            setAdFrequency(raw === "off" ? "off" : (Number(raw) as AdFrequency));
          }}
          className="w-full bg-input-bg border border-border rounded-sm px-2 py-1.5 text-base text-text outline-none"
        >
          {AD_FREQUENCIES.map((freq) => (
            <option key={freq} value={freq}>
              {adFrequencyLabel(freq)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">{t("settings.exportLibrary")}</div>
        <p className="text-sm text-text-dim mb-2">{t("settings.exportHint")}</p>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 bg-surface-alt border border-border rounded-pill px-3 py-2 text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={13} />
          {t("settings.exportLibrary")}
        </button>
        {storage && (
          <div className="text-sm text-text-faint mt-2">
            {t("settings.storageUsed", { used: formatBytes(storage.usage), total: formatBytes(storage.quota) })}
          </div>
        )}
      </div>

      <div>
        <div className="text-sm font-bold text-text-faint uppercase tracking-wide mb-2">{t("settings.keyboardShortcuts")}</div>
        <ul className="text-sm text-text-dim flex flex-col gap-1">
          <li className="flex justify-between">
            <span>{t("settings.shortcutPlayPause")}</span>
            <span className="text-text-faint">Space</span>
          </li>
          <li className="flex justify-between">
            <span>{t("settings.shortcutSeek")}</span>
            <span className="text-text-faint">← →</span>
          </li>
          <li className="flex justify-between">
            <span>{t("settings.shortcutVolume")}</span>
            <span className="text-text-faint">↑ ↓</span>
          </li>
          <li className="flex justify-between">
            <span>{t("settings.shortcutPrev")}</span>
            <span className="text-text-faint">Ctrl+←</span>
          </li>
          <li className="flex justify-between">
            <span>{t("settings.shortcutNext")}</span>
            <span className="text-text-faint">Ctrl+→</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
