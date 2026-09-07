import { useEffect, useRef, useState, type RefObject } from "react";

/** Generates an Object URL for a Blob only once the given element scrolls
 * into view, and revokes it the moment the element scrolls back out (or the
 * component unmounts) — a grid of 100 playlist covers should never hold 100
 * live Object URLs (and their underlying Blobs) in memory at once. */
export function useLazyObjectUrl(
  getBlob: () => Promise<Blob | undefined>,
  elRef: RefObject<Element | null>
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const getBlobRef = useRef(getBlob);
  getBlobRef.current = getBlob;
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let cancelled = false;

    function revoke() {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      if (!cancelled) setUrl(null);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          if (urlRef.current) return; // already loaded, nothing to do
          void getBlobRef.current().then((blob) => {
            if (cancelled || !blob) return;
            const created = URL.createObjectURL(blob);
            urlRef.current = created;
            setUrl(created);
          });
        } else {
          revoke();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      revoke();
    };
  }, [elRef]);

  return url;
}
