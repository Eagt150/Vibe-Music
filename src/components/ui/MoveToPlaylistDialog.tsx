import { useLocale } from "@/i18n/LocaleContext";
import type { PlaylistMeta } from "@/types";
import { Modal } from "./Modal";

interface MoveToPlaylistDialogProps {
  playlists: PlaylistMeta[];
  excludePlaylistId: string;
  onSelect: (playlistId: string) => void;
  onClose: () => void;
}

export function MoveToPlaylistDialog({ playlists, excludePlaylistId, onSelect, onClose }: MoveToPlaylistDialogProps) {
  const { t } = useLocale();
  const options = playlists.filter((p) => p.id !== excludePlaylistId);

  return (
    <Modal onClose={onClose}>
      <div className="text-md font-extrabold mb-3">{t("song.chooseDestination")}</div>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {options.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className="text-left px-3 py-2 rounded-md hover:bg-surface-alt text-base cursor-pointer"
          >
            {p.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}
