import { Users } from "lucide-react";
import { cn } from "@/lib/cn";

interface UserAvatarProps {
  name: string;
  url: string | null;
  size?: number;
  group?: boolean;
  className?: string;
}

/** Profile photo, or the first letter of the name on the accent color. */
export function UserAvatar({ name, url, size = 36, group = false, className }: UserAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (url) {
    return <img src={url} alt="" style={style} className={cn("rounded-full object-cover flex-shrink-0", className)} />;
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
