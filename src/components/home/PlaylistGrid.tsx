import { PlaylistCard } from "@/components/playlist/PlaylistCard";
import type { PlaylistMeta, SongMeta } from "@/types";

interface PlaylistGridProps {
  playlists: PlaylistMeta[];
  songsByPlaylist: Record<string, SongMeta[]>;
  onOpen: (id: string) => void;
}

export function PlaylistGrid({ playlists, songsByPlaylist, onOpen }: PlaylistGridProps) {
  return (
    <div className="grid gap-4 md:gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
      {playlists.map((p) => {
        const songs = songsByPlaylist[p.id] ?? [];
        return (
          <PlaylistCard
            key={p.id}
            playlist={p}
            songCount={songs.length}
            songTitles={songs.map((s) => s.title)}
            onClick={() => onOpen(p.id)}
          />
        );
      })}
    </div>
  );
}
