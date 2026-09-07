import { X } from "lucide-react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useLibrary } from "@/context/LibraryContext";
import { useUiState } from "@/context/UiStateContext";
import { useDragReorder } from "@/hooks/useDragReorder";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueueRow } from "./QueueRow";
import type { SongMeta } from "@/types";

export function QueuePanel() {
  const { isQueueOpen, closeQueue } = useUiState();
  const { queue, reorderQueue, removeFromQueue } = useAudioPlayer();
  const { songsByPlaylist } = useLibrary();
  const { getHandlers } = useDragReorder(reorderQueue);

  if (!isQueueOpen) return null;

  const resolved = queue
    .map((item, index) => {
      const song = songsByPlaylist[item.playlistId]?.find((s) => s.id === item.songId);
      return song ? { index, song } : null;
    })
    .filter((x): x is { index: number; song: SongMeta } => x !== null);

  return (
    <>
      <div className="fixed inset-0 bg-overlay z-[69]" onClick={closeQueue} />
      <div className="fixed inset-y-0 right-0 z-[70] w-full md:w-[340px] bg-surface border-l border-border flex flex-col shadow-[-8px_0_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between px-4.5 pt-4.5 pb-3 border-b border-border">
          <div className="text-md font-extrabold">Queue</div>
          <button
            type="button"
            onClick={closeQueue}
            className="cursor-pointer text-text-dim hover:text-text"
            aria-label="Close queue"
          >
            <X size={16} />
          </button>
        </div>
        {resolved.length === 0 ? (
          <EmptyState title="Queue is empty" subtitle="Play a playlist to fill it up." />
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {resolved.map(({ index, song }) => (
              <QueueRow
                key={`${index}-${song.id}`}
                title={song.title}
                artist={song.artist}
                durationSec={song.durationSec}
                onRemove={() => removeFromQueue(index)}
                dragHandlers={getHandlers(index)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
