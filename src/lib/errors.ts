export function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "QuotaExceededError";
}

/** Checks current storage usage against the browser's estimated quota.
 * Returns null when the Storage API isn't available (older browsers). */
export async function getStorageUsageRatio(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  if (!usage || !quota) return null;
  return usage / quota;
}

export class ImportItemError extends Error {
  constructor(
    public fileName: string,
    message: string
  ) {
    super(message);
    this.name = "ImportItemError";
  }
}
