import { useEffect } from "react";

/** Asks "Are you sure you want to leave?" when the tab is closed or reloaded.
 * Browsers show their own fixed wording for this dialog (custom text is
 * ignored), and only once the user has interacted with the page. */
export function useConfirmBeforeUnload(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Older Chromium/Safari still need returnValue set to show the prompt.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
