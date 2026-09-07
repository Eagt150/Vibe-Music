import { CoverArt } from "@/components/ui/CoverArt";
import type { PlaylistMeta, RecentlyPlayedEntry, SongMeta } from "@/types";

interface RecentlyPlayedRowProps {
  entries: RecentlyPlayedEntry[];
  playlists: PlaylistMeta[];
  songsByPlaylist: Record<string, SongMeta[]>;
  onPlay: (playlistId: string, songId: string) => void;
}

export function RecentlyPlayedRow({ entries, playlists, songsByPlaylist, onPlay }: RecentlyPlayedRowProps) {
  const resolved = entries
    .map((entry) => {
      const playlist = playlists.find((p) => p.id === entry.playlistId);
      const song = songsByPlaylist[entry.playlistId]?.find((s) => s.id === entry.songId);
      return playlist && song ? { entry, playlist, song } : null;
    })
    .filter((x): x is { entry: RecentlyPlayedEntry; playlist: PlaylistMeta; song: SongMeta } => x !== null);

  if (resolved.length === 0) return null;

  return (
    <>
      <div className="text-base font-bold text-text-dim uppercase tracking-wide mt-8 mb-3.5">Recently Played</div>
      <div className="flex gap-3.5 overflow-x-auto pb-1.5">
        {resolved.map(({ entry, playlist, song }) => (
          <button
            type="button"
            key={`${entry.playlistId}-${entry.songId}`}
            onClick={() => onPlay(entry.playlistId, entry.songId)}
            className="flex items-center gap-2.5 bg-surface border border-border rounded-md p-2.5 min-w-[210px] cursor-pointer flex-shrink-0 text-left"
          >
            <CoverArt
              coverHash={playlist.coverHash}
              songTitles={[song.title]}
              hue={playlist.hue}
              size="sm"
              className="w-10 h-10"
            />
            <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
              <div className="text-sm font-bold truncate">{song.title}</div>
              <div className="text-sm text-text-dim truncate">{song.artist}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
