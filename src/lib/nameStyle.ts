import type { CSSProperties } from "react";

/** Inline style for a display name in its chosen color or two-color gradient. */
export function nameStyle(color: string | null, color2: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  if (color2) {
    return {
      backgroundImage: `linear-gradient(90deg, ${color}, ${color2})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }
  return { color };
}
