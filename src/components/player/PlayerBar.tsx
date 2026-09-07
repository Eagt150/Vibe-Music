import { Maximize2, Menu } from "lucide-react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useUiState } from "@/context/UiStateContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { IconButton } from "@/components/ui/IconButton";
import { PlayerBarCover } from "./PlayerBarCover";
import { PlayerBarControls } from "./PlayerBarControls";
import { ProgressBar } from "./ProgressBar";
import { VolumeSlider } from "./VolumeSlider";

export function PlayerBar() {
  const { playingSongId, progressSec, durationSec, volumeLevel, seek, seekByRatio, setVolume } = useAudioPlayer();
  const { toggleQueue, openFullScreen } = useUiState();
  const isMobile = useIsMobile();

  if (!playingSongId) return null;

  return (
    <div className="flex items-center gap-3 md:gap-5 px-3 md:px-6 py-2 border-t border-border bg-surface flex-shrink-0 relative z-20">
      <PlayerBarCover />

      <div className="flex-[0_0_auto] md:flex-1 flex flex-col gap-1.5 items-center min-w-0 md:max-w-[520px] md:mx-auto">
        <PlayerBarControls />
        {!isMobile && (
          <ProgressBar currentSec={progressSec} durationSec={durationSec} onSeekRatio={seekByRatio} onSeekSeconds={seek} />
        )}
      </div>

      <div className="flex items-center gap-2.5 md:flex-[0_1_220px] md:justify-end">
        <IconButton onClick={toggleQueue} title="Queue" aria-label="Queue" size={isMobile ? 28 : 34}>
          <Menu size={16} />
        </IconButton>
        <VolumeSlider value={volumeLevel} onChange={setVolume} />
        {!isMobile && (
          <IconButton onClick={openFullScreen} title="Expand" aria-label="Expand" size={34}>
            <Maximize2 size={15} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
