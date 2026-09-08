import { useDragReorder } from "@/hooks/useDragReorder";
import { SongRow } from "./SongRow";
import type { SongMeta } from "@/types";

interface SongListProps {
  songs: SongMeta[];
  playingSongId: string | null;
  isPlaying: boolean;
  onToggleFavorite: (songId: string) => void;
  onPlaySong: (songId: string) => void;
  onReorder: (orderedSongIds: string[]) => void;
  onMoveToPlaylist: (songId: string) => void;
  onDelete: (songId: string) => void;
}

export function SongList({
  songs,
  playingSongId,
  isPlaying,
  onToggleFavorite,
  onPlaySong,
  onReorder,
  onMoveToPlaylist,
  onDelete,
}: SongListProps) {
  const { getHandlers } = useDragReorder((from, to) => {
    const ids = songs.map((s) => s.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  });

  return (
    <div className="flex flex-col">
      {songs.map((song, i) => (
        <SongRow
          key={song.id}
          song={song}
          index={i + 1}
          isCurrent={song.id === playingSongId}
          isPlaying={isPlaying}
          onToggleFavorite={() => onToggleFavorite(song.id)}
          onPlayToggle={() => onPlaySong(song.id)}
          onMoveToPlaylist={() => onMoveToPlaylist(song.id)}
          onDelete={() => onDelete(song.id)}
          dragHandlers={getHandlers(i)}
        />
      ))}
    </div>
  );
}
