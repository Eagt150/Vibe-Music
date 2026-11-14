import { useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/cn";
import { UserName } from "./UserName";
import type { Profile } from "./types";

export type ProfileCardData = Pick<
  Profile,
  | "displayName"
  | "username"
  | "avatarUrl"
  | "avatarStillUrl"
  | "nameColor"
  | "nameColor2"
  | "tag"
  | "isAdmin"
  | "bio"
  | "bannerUrl"
  | "bannerStillUrl"
  | "cardBgUrl"
  | "cardBgStillUrl"
  | "cardColor1"
  | "cardColor2"
> & { mutualFriends?: Profile["mutualFriends"]; mutualCount?: number };

interface ProfileCardProps {
  profile: ProfileCardData;
  /** Buttons at the bottom (message, add friend, edit profile). */
  actions?: ReactNode;
  mutualLabel?: string;
  className?: string;
}

/** Discord-style profile card: banner, avatar overlapping it, colored name
 * with tag, @username, bio and mutual friends — on the user's own
 * background image or two-color theme. Animated images play on hover. */
export function ProfileCard({ profile, actions, mutualLabel, className }: ProfileCardProps) {
  const [hover, setHover] = useState(false);
  const pick = (url: string | null, still: string | null) => (still && !hover ? still : url);
  const banner = pick(profile.bannerUrl, profile.bannerStillUrl);
  const cardBg = pick(profile.cardBgUrl, profile.cardBgStillUrl);
  const c1 = profile.cardColor1;
  const c2 = profile.cardColor2 ?? profile.cardColor1;
  const themeBackground = c1 ? `linear-gradient(180deg, ${c1}, ${c2})` : undefined;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("relative w-full rounded-lg overflow-hidden border border-border bg-surface", className)}
      style={themeBackground && !cardBg ? { background: themeBackground } : undefined}
    >
      {cardBg && <img src={cardBg} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />}

      <div className="relative h-[110px]" style={!banner ? { background: c1 ?? "var(--accent)" } : undefined}>
        {banner && <img src={banner} alt="" className="w-full h-full object-cover" />}
      </div>

      <div className="relative px-4 pb-4">
        <div className="-mt-11 mb-2">
          <span className="inline-block rounded-full p-1.5 bg-surface">
            <UserAvatar
              name={profile.displayName}
              url={profile.avatarUrl}
              stillUrl={profile.avatarStillUrl}
              animate={hover}
              size={84}
            />
          </span>
        </div>

        <div className="rounded-md bg-surface/85 backdrop-blur-sm p-3 flex flex-col gap-2">
          <div>
            <UserName user={profile} className="text-lg font-extrabold" />
            <div className="text-sm text-text-dim">@{profile.username}</div>
          </div>
          {profile.bio && <p className="text-base whitespace-pre-wrap break-words">{profile.bio}</p>}
          {profile.mutualFriends && profile.mutualFriends.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-text-dim">
              <span className="flex -space-x-1.5">
                {profile.mutualFriends.map((f) => (
                  <UserAvatar
                    key={f._id}
                    name={f.displayName}
                    url={f.avatarUrl}
                    stillUrl={f.avatarStillUrl}
                    size={20}
                    className="ring-2 ring-surface"
                  />
                ))}
              </span>
              {mutualLabel}
            </div>
          )}
          {actions && <div className="flex gap-2 pt-1">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
