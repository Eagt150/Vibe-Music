import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Pause, Play } from "lucide-react";
import { useLocale } from "@/i18n/LocaleContext";
import { formatDuration } from "@/lib/format";

/** A voice note: play/pause, a seekable progress bar and the time. The
 * duration comes from the message (browsers often can't read it from a
 * freshly recorded WebM file). */
export function VoicePlayer({ url, durationMs }: { url: string; durationMs: number }) {
  const { t } = useLocale();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const total = durationMs / 1000;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setPosition(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function seek(e: MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(total, ((e.clientX - rect.left) / rect.width) * total));
  }

  const progress = total > 0 ? Math.min(1, position / total) : 0;
  return (
    <div className="flex items-center gap-2.5 bg-surface-alt border border-border rounded-pill pl-1.5 pr-3.5 py-1.5 mt-1 w-[260px] max-w-full">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("song.pause") : t("song.play")}
        className="w-8 h-8 rounded-full bg-accent text-accent-text inline-flex items-center justify-center cursor-pointer flex-shrink-0"
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="flex-1 h-1.5 rounded-pill bg-border cursor-pointer relative" onClick={seek} role="presentation">
        <div className="absolute inset-y-0 left-0 rounded-pill bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-xs text-text-dim tabular-nums flex-shrink-0">
        {formatDuration(playing || position > 0 ? position : total)}
      </span>
    </div>
  );
}
