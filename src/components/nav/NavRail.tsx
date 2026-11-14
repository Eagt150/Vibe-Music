import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { MessageCircle, Music, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useUiState, type Section } from "@/context/UiStateContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useLocale } from "@/i18n/LocaleContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ProfileDialog } from "@/components/profile/ProfileDialog";
import { cn } from "@/lib/cn";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-pill bg-danger text-white text-xs font-bold inline-flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

interface NavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
  mobile: boolean;
}

function NavItem({ label, active, onClick, badge = 0, children, mobile }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center justify-center cursor-pointer transition-colors",
        mobile ? "flex-1 flex-col gap-0.5 py-1.5 text-xs font-bold" : "w-11 h-11 rounded-lg",
        active
          ? mobile
            ? "text-accent"
            : "bg-accent text-accent-text"
          : mobile
            ? "text-text-dim"
            : "text-text-dim hover:text-text hover:bg-surface-alt"
      )}
    >
      <span className="relative inline-flex">
        {children}
        <Badge count={badge} />
      </span>
      {mobile && <span>{label}</span>}
    </button>
  );
}

/** Switches between Music, Messages and (for the admin) access requests —
 * a vertical rail on desktop, a tab strip on mobile. */
export function NavRail() {
  const { t } = useLocale();
  const { section, setSection, isProfileEditorOpen, setProfileEditorOpen } = useUiState();
  const isMobile = useIsMobile();
  const me = useQuery(api.users.me);
  const conversations = useQuery(api.conversations.list);
  const isAdmin = me?.role === "admin";
  const requests = useQuery(api.users.listAccessRequests, isAdmin ? {} : "skip");

  // Muted chats only count when they mention me.
  const unread = conversations?.reduce((sum, c) => sum + (c.muted ? c.unreadMentions : c.unreadCount), 0) ?? 0;
  const go = (s: Section) => () => setSection(s);

  const items = (
    <>
      <NavItem label={t("nav.music")} active={section === "music"} onClick={go("music")} mobile={isMobile}>
        <Music size={18} />
      </NavItem>
      <NavItem label={t("nav.messages")} active={section === "messages"} onClick={go("messages")} badge={unread} mobile={isMobile}>
        <MessageCircle size={18} />
      </NavItem>
      {isAdmin && (
        <NavItem
          label={t("nav.admin")}
          active={section === "admin"}
          onClick={go("admin")}
          badge={requests?.length ?? 0}
          mobile={isMobile}
        >
          <ShieldCheck size={18} />
        </NavItem>
      )}
    </>
  );

  const avatarButton = me && (
    <button
      type="button"
      onClick={() => setProfileEditorOpen(true)}
      title={t("nav.profile")}
      aria-label={t("nav.profile")}
      className={cn("cursor-pointer rounded-full", isMobile ? "px-3" : "")}
    >
      <UserAvatar name={me.displayName} url={me.avatarUrl} stillUrl={me.avatarStillUrl} size={isMobile ? 28 : 36} />
    </button>
  );

  return (
    <>
      {isMobile ? (
        <nav className="flex items-center border-b border-border bg-surface flex-shrink-0">
          {items}
          {avatarButton}
        </nav>
      ) : (
        <nav className="flex flex-col items-center gap-2 py-3.5 w-[64px] bg-bg border-r border-border flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-accent mb-3" aria-hidden />
          {items}
          <div className="flex-1" />
          {avatarButton}
        </nav>
      )}
      {isProfileEditorOpen && <ProfileDialog onClose={() => setProfileEditorOpen(false)} />}
    </>
  );
}
