import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

interface PlaylistEmptyStateProps {
  onAddSongsClick: () => void;
}

export function PlaylistEmptyState({ onAddSongsClick }: PlaylistEmptyStateProps) {
  return (
    <EmptyState
      title="This playlist is empty"
      subtitle="Add songs to start listening."
      action={
        <Button icon={<Plus size={14} />} onClick={onAddSongsClick}>
          Add songs
        </Button>
      }
    />
  );
}
