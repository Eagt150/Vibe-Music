import { useEffect, useState } from "react";

export interface StorageEstimate {
  usage: number;
  quota: number;
}

/** Pass a changing `refreshKey` (e.g. songs count) to re-check after the
 * library changes — the Storage API doesn't push updates on its own. */
export function useStorageEstimate(refreshKey?: unknown): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((e) => {
      if (!cancelled && e.usage !== undefined && e.quota !== undefined) {
        setEstimate({ usage: e.usage, quota: e.quota });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return estimate;
}
