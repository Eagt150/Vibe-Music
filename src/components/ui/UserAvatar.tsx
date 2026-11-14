import { Users } from "lucide-react";
import { cn } from "@/lib/cn";

interface UserAvatarProps {
  name: string;
  url: string | null;
  /** First frame of an animated avatar. When given, it's shown until `animate`. */
  stillUrl?: string | null;
  animate?: boolean;
  size?: number;
  group?: boolean;
  className?: string;
}

/** Profile photo, or the first letter of the name on the accent color. GIF
 * avatars stay still until `animate` (the row or card is hovered). */
export function UserAvatar({ name, url, stillUrl, animate = false, size = 36, group = false, className }: UserAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  const src = stillUrl && !animate ? stillUrl : url;
  if (src) {
    return <img src={src} alt="" style={style} className={cn("rounded-full object-cover flex-shrink-0", className)} />;
  }
  return (
    <span
      style={style}
      className={cn(
        "rounded-full flex-shrink-0 inline-flex items-center justify-center font-extrabold uppercase",
        group ? "bg-surface-alt text-text-dim border border-border" : "bg-accent text-accent-text",
        className
      )}
    >
      {group ? <Users size={Math.round(size * 0.45)} /> : (name.trim()[0] ?? "?")}
    </span>
  );
}
