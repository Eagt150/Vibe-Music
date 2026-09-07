import { ChevronDown, Heart, Menu } from "lucide-react";
import { CoverArt } from "@/components/ui/CoverArt";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useLibrary } from "@/context/LibraryContext";
import { useUiState } from "@/context/UiStateContext";
import { PlayerBarControls } from "./PlayerBarControls";
import { ProgressBar } from "./ProgressBar";

export function FullScreenPlayer() {
  const { isFullScreenOpen, closeFullScreen, toggleQueue } = useUiState();
  const { playingPlaylistId, playingSongId, progressSec, durationSec, seek, seekByRatio } = useAudioPlayer();
  const { playlists, songsByPlaylist, toggleFavorite } = useLibrary();

  if (!isFullScreenOpen) return null;

  const playlist = playlists.find((p) => p.id === playingPlaylistId);
  const song = playingPlaylistId ? songsByPlaylist[playingPlaylistId]?.find((s) => s.id === playingSongId) : undefined;
  if (!playlist || !song) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-bg text-text flex flex-col items-center px-5 pt-7 pb-10 md:px-10 overflow-y-auto">
      <div className="flex items-center justify-between w-full max-w-[480px]">
        <button type="button" onClick={closeFullScreen} className="cursor-pointer text-text" aria-label="Collapse">
          <ChevronDown size={22} />
        </button>
        <div className="text-sm font-bold tracking-wider text-text-dim">NOW PLAYING</div>
        <button type="button" onClick={toggleQueue} className="cursor-pointer text-text" aria-label="Queue">
          <Menu size={20} />
        </button>
      </div>

      <div className="mt-5 mb-7">
        <CoverArt coverHash={playlist.coverHash} songTitles={[song.title]} hue={playlist.hue} size="xl" />
      </div>

      <div className="text-xl font-extrabold text-center">{song.title}</div>
      <div className="text-base text-text-dim mt-1 mb-6">{song.artist}</div>

      <div className="w-full max-w-[480px]">
        <ProgressBar currentSec={progressSec} durationSec={durationSec} onSeekRatio={seekByRatio} onSeekSeconds={seek} size="lg" />
      </div>

      <div className="mt-6">
        <PlayerBarControls size="lg" />
      </div>

      <button
        type="button"
        onClick={() => void toggleFavorite(song.id, playlist.id)}
        className="mt-7 flex items-center gap-1.5 border border-border rounded-pill px-4.5 py-2 text-sm font-semibold cursor-pointer"
      >
        <Heart size={14} fill={song.favorite ? "currentColor" : "none"} className={song.favorite ? "text-accent" : ""} />
        Favorite
      </button>
    </div>
  );
}
