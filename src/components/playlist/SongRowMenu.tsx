import { useRef, useState } from "react";
import { FolderInput, MoreVertical, Trash2 } from "lucide-react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { useLocale } from "@/i18n/LocaleContext";

interface SongRowMenuProps {
  onMoveToPlaylist: () => void;
  onDelete: () => void;
}

export function SongRowMenu({ onMoveToPlaylist, onDelete }: SongRowMenuProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-text-faint hover:text-text cursor-pointer p-1"
        aria-label={t("song.moreOptions")}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 bg-surface border border-border rounded-md py-1 w-44 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onMoveToPlaylist();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-alt cursor-pointer"
          >
            <FolderInput size={13} /> {t("song.moveToPlaylist")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-danger hover:bg-surface-alt cursor-pointer"
          >
            <Trash2 size={13} /> {t("song.delete")}
          </button>
        </div>
      )}
    </div>
  );
}
