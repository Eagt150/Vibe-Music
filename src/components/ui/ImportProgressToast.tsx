import { Loader2 } from "lucide-react";
import { useUiState } from "@/context/UiStateContext";

/** Live "X / Y" feedback while a batch import is running — without this,
 * importing many files looks frozen since duration decode + ID3 parsing
 * per file can take a while and there was previously no visible progress. */
export function ImportProgressToast() {
  const { importProgress } = useUiState();
  if (!importProgress) return null;

  const { completed, total } = importProgress;
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;

  return (
    <div className="fixed bottom-[86px] md:bottom-6 right-4 md:right-6 z-40 bg-surface border border-border rounded-md px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] min-w-[220px]">
      <div className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
        <Loader2 size={14} className="animate-spin text-accent" />
        Importing songs… {completed} / {total}
      </div>
      <div className="h-[5px] bg-surface-alt rounded-pill overflow-hidden">
        <div className="h-full bg-accent rounded-pill transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
