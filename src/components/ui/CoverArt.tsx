import { useRef } from "react";
import { getCover } from "@/lib/db/covers";
import { buildQuadrants } from "@/lib/coverArt";
import { useLazyObjectUrl } from "@/hooks/useLazyObjectUrl";
import { useLocale } from "@/i18n/LocaleContext";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "w-[22px] h-[22px] rounded-md",
  md: "w-full aspect-square rounded-md",
  lg: "w-24 h-24 md:w-40 md:h-40 rounded-lg",
  xl: "w-[78vw] max-w-[320px] h-[78vw] max-h-[320px] md:w-[340px] md:h-[340px] rounded-xl",
};

interface CoverArtProps {
  coverHash?: string;
  songTitles: string[];
  hue: number;
  size: Size;
  showEmptyLabel?: boolean;
  className?: string;
}

/** Renders a playlist's cover: a custom uploaded image (lazily loaded — see
 * useLazyObjectUrl), an auto-generated 2x2 quadrant collage from the first
 * songs' titles, or a striped "ADD SONGS" placeholder for an empty playlist.
 *
 * `size="sm"` (sidebar swatches) skips all of that and just renders a flat
 * solid color from the playlist's own `hue` — cheap, and appropriate at 22px
 * where a collage wouldn't be legible anyway. */
export function CoverArt({ coverHash, songTitles, hue, size, showEmptyLabel = true, className }: CoverArtProps) {
  const { t } = useLocale();
  const elRef = useRef<HTMLDivElement>(null);
  const imageUrl = useLazyObjectUrl(
    () => (coverHash ? getCover(coverHash) : Promise.resolve(undefined)),
    elRef
  );

  if (size === "sm") {
    return (
      <div
        ref={elRef}
        className={cn(SIZE_CLASSES.sm, "flex-shrink-0", className)}
        style={{ background: `hsl(${hue}, 70%, 45%)` }}
      />
    );
  }

  if (coverHash) {
    return (
      <div ref={elRef} className={cn(SIZE_CLASSES[size], "flex-shrink-0 bg-surface-alt overflow-hidden", className)}>
        {imageUrl && (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>
    );
  }

  if (songTitles.length === 0) {
    return (
      <div
        ref={elRef}
        className={cn(
          SIZE_CLASSES[size],
          "flex-shrink-0 flex items-center justify-center",
          className
        )}
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, hsl(${hue},70%,38%), hsl(${hue},70%,38%) 10px, hsl(${hue},70%,30%) 10px, hsl(${hue},70%,30%) 20px)`,
        }}
      >
        {showEmptyLabel && (
          <span className="font-mono text-[10px] tracking-wider text-white/85 bg-black/35 px-1.5 py-0.5 rounded">
            {t("playlist.coverPlaceholderLabel")}
          </span>
        )}
      </div>
    );
  }

  const quadrants = buildQuadrants(songTitles);
  return (
    <div ref={elRef} className={cn(SIZE_CLASSES[size], "flex-shrink-0 grid grid-cols-2 grid-rows-2 overflow-hidden", className)}>
      {quadrants.map((q, i) => (
        <div
          key={i}
          className="flex items-center justify-center font-mono font-bold text-white/85"
          style={{ background: `hsl(${q.hue}, 45%, 32%)`, fontSize: size === "xl" ? 34 : size === "lg" ? 22 : 13 }}
        >
          {q.glyph}
        </div>
      ))}
    </div>
  );
}
