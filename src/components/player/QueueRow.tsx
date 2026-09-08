import { GripVertical, X } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { useLocale } from "@/i18n/LocaleContext";
import type { DragHandlers } from "@/hooks/useDragReorder";

interface QueueRowProps {
  title: string;
  artist: string;
  durationSec: number;
  onRemove: () => void;
  dragHandlers: DragHandlers;
}

export function QueueRow({ title, artist, durationSec, onRemove, dragHandlers }: QueueRowProps) {
  const { t } = useLocale();
  return (
    <div
      {...dragHandlers}
      className="flex items-center gap-2.5 px-1.5 py-2.5 rounded-md cursor-grab hover:bg-surface-alt/40"
    >
      <GripVertical size={13} className="text-text-faint flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="text-md font-semibold truncate">{title}</div>
        <div className="text-sm text-text-dim truncate">{artist}</div>
      </div>
      <span className="text-sm text-text-faint flex-shrink-0">{formatDuration(durationSec)}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-text-faint hover:text-text cursor-pointer flex-shrink-0"
        aria-label={t("queue.remove")}
      >
        <X size={13} />
      </button>
    </div>
  );
}
