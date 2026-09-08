import { useRef, useState } from "react";
import type { DuplicateDecision, DuplicateInfo, DuplicateResolver } from "@/lib/importFiles";

/** Bridges importFilesToPlaylist's async onDuplicate callback to a React
 * confirmation dialog: calling onDuplicate shows the dialog and returns a
 * Promise that only resolves once the user clicks Skip/Import (via respond). */
export function useDuplicateConfirm() {
  const [pending, setPending] = useState<DuplicateInfo | null>(null);
  const resolverRef = useRef<((result: { decision: DuplicateDecision; applyToAll: boolean }) => void) | null>(null);

  const onDuplicate: DuplicateResolver = (info) => {
    setPending(info);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  };

  function respond(decision: DuplicateDecision, applyToAll: boolean) {
    resolverRef.current?.({ decision, applyToAll });
    resolverRef.current = null;
    setPending(null);
  }

  return { pending, onDuplicate, respond };
}
