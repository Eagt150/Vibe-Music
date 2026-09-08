import { Heart } from "lucide-react";
import { CoverArt } from "@/components/ui/CoverArt";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useLibrary } from "@/context/LibraryContext";
import { useUiState } from "@/context/UiStateContext";
import { useLocale } from "@/i18n/LocaleContext";

export function PlayerBarCover() {
  const { t } = useLocale();
  const { playingPlaylistId, playingSongId } = useAudioPlayer();
  const { playlists, songsByPlaylist, toggleFavorite } = useLibrary();
  const { openFullScreen } = useUiState();

  const playlist = playlists.find((p) => p.id === playingPlaylistId);
  const song = playingPlaylistId ? songsByPlaylist[playingPlaylistId]?.find((s) => s.id === playingSongId) : undefined;

  if (!playlist || !song) return <div className="flex-1 md:flex-none md:w-[220px]" />;

  return (
    <div
      className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-none md:w-[220px] cursor-pointer"
      onClick={openFullScreen}
    >
      <CoverArt
        coverHash={playlist.coverHash}
        songTitles={[song.title]}
        hue={playlist.hue}
        size="sm"
        className="w-[42px] h-[42px] rounded-md"
      />
      <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
        <div className="text-sm font-bold truncate">{song.title}</div>
        <div className="text-[11.5px] text-text-dim truncate">{song.artist}</div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void toggleFavorite(song.id, playlist.id);
        }}
        className={song.favorite ? "text-accent flex-shrink-0" : "text-text-faint flex-shrink-0"}
        aria-label={song.favorite ? t("song.unfavorite") : t("song.favorite")}
      >
        <Heart size={15} fill={song.favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
