interface NameplateProps {
  url: string | null | undefined;
  stillUrl?: string | null;
  /** Play an animated GIF (otherwise its still frame is shown). */
  animate?: boolean;
}

/** The decorative image behind a person's name, Discord-style. Rows are far
 * wider than most pictures, so stretching one across would show only a thin,
 * zoomed-in slice. Instead a blurred copy tints the whole row and the full
 * picture sits on the right, fading out towards the name; a dark wash keeps
 * text readable over bright images. The parent must be `relative` and its
 * content above it (`relative` too). */
export function Nameplate({ url, stillUrl, animate }: NameplateProps) {
  const src = stillUrl && !animate ? stillUrl : url;
  if (!src) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-125 blur-xl opacity-60"
      />
      <img
        src={src}
        alt=""
        className="absolute inset-y-0 right-0 h-full w-auto max-w-[75%] object-cover [mask-image:linear-gradient(to_right,transparent,black_40%)]"
      />
      <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/25" />
    </span>
  );
}
