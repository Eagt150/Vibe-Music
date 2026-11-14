import { useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/cn";
import { UserName } from "./UserName";
import type { PublicUser } from "./types";

interface UserRowProps {
  user: PublicUser;
  subtitle?: ReactNode;
  active?: boolean;
  avatarSize?: number;
  onClick?: () => void;
  onAvatarClick?: () => void;
  /** Buttons on the right. */
  children?: ReactNode;
  className?: string;
}

/** A person in a list, Discord-style: avatar, colored name, tag pill, and
 * their nameplate image behind the row. GIFs animate while hovered. */
export function UserRow({ user, subtitle, active, avatarSize = 36, onClick, onAvatarClick, children, className }: UserRowProps) {
  const [hover, setHover] = useState(false);
  const nameplate = user.nameplateStillUrl && !hover ? user.nameplateStillUrl : user.nameplateUrl;
  const Body = onClick ? "button" : "div";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "relative flex items-center gap-3 px-2.5 py-1.5 rounded-md overflow-hidden",
        active ? "bg-surface-alt" : "hover:bg-surface-alt/60",
        className
      )}
    >
      {nameplate && (
        <>
          <img src={nameplate} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-90" />
          {/* Fades the image towards the left so the name stays readable. */}
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/55 to-transparent" />
        </>
      )}
      <button
        type="button"
        onClick={onAvatarClick ?? onClick}
        tabIndex={onAvatarClick ? 0 : -1}
        className="relative flex-shrink-0 cursor-pointer rounded-full"
      >
        <UserAvatar
          name={user.displayName}
          url={user.avatarUrl}
          stillUrl={user.avatarStillUrl}
          animate={hover}
          size={avatarSize}
        />
      </button>
      <Body
        {...(onClick ? { type: "button" as const, onClick } : {})}
        className={cn("relative flex-1 min-w-0 text-left", onClick && "cursor-pointer")}
      >
        <UserName user={user} className="font-bold text-base" />
        {subtitle && <div className="text-sm text-text-dim truncate">{subtitle}</div>}
      </Body>
      {children && <div className="relative flex items-center gap-1.5 flex-shrink-0">{children}</div>}
    </div>
  );
}
