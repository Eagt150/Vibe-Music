import { nameStyle } from "@/lib/nameStyle";
import { cn } from "@/lib/cn";
import type { PublicUser } from "./types";

type NameUser = Pick<PublicUser, "displayName" | "nameColor" | "nameColor2" | "tag" | "isAdmin">;

interface UserNameProps {
  user: NameUser;
  className?: string;
  /** Show the tag pill and the admin crown (off in tight spots). */
  decorations?: boolean;
}

/** A display name in the user's color, followed by their tag pill
 * (emoji + up to 4 letters) and a 👑 for the app admin. */
export function UserName({ user, className, decorations = true }: UserNameProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0 max-w-full", className)}>
      <span className="truncate" style={nameStyle(user.nameColor, user.nameColor2)}>
        {user.displayName}
      </span>
      {decorations && user.isAdmin && (
        <span className="flex-shrink-0 text-xs" title="Admin" aria-label="Admin">
          👑
        </span>
      )}
      {decorations && user.tag && <UserTag tag={user.tag} />}
    </span>
  );
}

export function UserTag({ tag }: { tag: NonNullable<PublicUser["tag"]> }) {
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-px rounded-sm bg-surface-alt border border-border text-[10.5px] font-extrabold tracking-wide text-text leading-tight">
      {tag.emoji && <span className="text-[11px] leading-none">{tag.emoji}</span>}
      {tag.text}
    </span>
  );
}
