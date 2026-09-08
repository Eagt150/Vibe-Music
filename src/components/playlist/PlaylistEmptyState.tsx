import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLocale } from "@/i18n/LocaleContext";

interface PlaylistEmptyStateProps {
  onAddSongsClick: () => void;
}

export function PlaylistEmptyState({ onAddSongsClick }: PlaylistEmptyStateProps) {
  const { t } = useLocale();
  return (
    <EmptyState
      title={t("playlist.empty")}
      subtitle={t("playlist.emptySubtitle")}
      action={
        <Button icon={<Plus size={14} />} onClick={onAddSongsClick}>
          {t("playlist.addSongs")}
        </Button>
      }
    />
  );
}
