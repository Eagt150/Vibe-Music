import { useState } from "react";
import { AtSign, BellOff, Plus, Users } from "lucide-react";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { UserName } from "@/components/user/UserName";
import { Nameplate } from "@/components/user/Nameplate";
import { Button } from "@/components/ui/Button";
import { formatChatTime } from "@/lib/chatTime";
import { cn } from "@/lib/cn";
import type { ConversationId, ConversationSummary } from "./types";

interface ConversationListProps {
  conversations: ConversationSummary[] | undefined;
  selectedId: ConversationId | null;
  friendsActive: boolean;
  incomingRequests: number;
  onSelect: (id: ConversationId) => void;
  onOpenFriends: () => void;
  onNewGroup: () => void;
}

export function ConversationList({
  conversations,
  selectedId,
  friendsActive,
  incomingRequests,
  onSelect,
  onOpenFriends,
  onNewGroup,
}: ConversationListProps) {
  const { t } = useLocale();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <span className="font-extrabold text-lg">{t("messages.title")}</span>
        <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={onNewGroup}>
          {t("messages.newGroup")}
        </Button>
      </div>

      <div className="px-2">
        <button
          type="button"
          onClick={onOpenFriends}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-base font-semibold cursor-pointer",
            friendsActive ? "bg-surface-alt text-accent" : "hover:bg-surface-alt/50"
          )}
        >
          <Users size={15} />
          <span className="flex-1 text-left">{t("messages.friends")}</span>
          {incomingRequests > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-pill bg-danger text-white text-xs font-bold inline-flex items-center justify-center">
              {incomingRequests}
            </span>
          )}
        </button>
      </div>

      <div className="h-px bg-border mx-4 my-2" />

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations?.length === 0 && (
          <div className="px-3 py-8 text-center">
            <div className="font-bold text-base">{t("messages.noConversations")}</div>
            <div className="text-sm text-text-dim mt-1">{t("messages.noConversationsSubtitle")}</div>
          </div>
        )}
        {conversations?.map((c) => (
          <ConversationRow key={c._id} c={c} selected={selectedId === c._id} onSelect={() => onSelect(c._id)} />
        ))}
      </div>
    </div>
  );
}

const KIND_PREVIEW: Partial<Record<string, TranslationKey>> = {
  gif: "messages.gifPreview",
  sticker: "messages.stickerPreview",
  voice: "messages.voicePreview",
  image: "messages.imagePreview",
};

function ConversationRow({ c, selected, onSelect }: { c: ConversationSummary; selected: boolean; onSelect: () => void }) {
  const { t, locale } = useLocale();
  const [hover, setHover] = useState(false);
  const kindKey = c.lastMessage ? KIND_PREVIEW[c.lastMessage.kind] : undefined;
  const previewBody = kindKey ? t(kindKey) : (c.lastMessage?.body ?? "");
  const preview = c.lastMessage
    ? `${c.lastMessage.mine ? t("messages.you") : c.kind === "group" ? c.lastMessage.authorName : ""}${
        c.lastMessage.mine || c.kind === "group" ? ": " : ""
      }${previewBody}`
    : c.kind === "group"
      ? t("messages.members", { count: c.memberCount })
      : "";
  const unread = c.muted ? c.unreadMentions : c.unreadCount;
  const user = c.user;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "relative w-full flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer text-left overflow-hidden",
        selected ? "bg-surface-alt" : "hover:bg-surface-alt/50",
        c.muted && unread === 0 && "opacity-60",
        user?.nameplateUrl && "[text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
      )}
    >
      {user && <Nameplate url={user.nameplateUrl} stillUrl={user.nameplateStillUrl} animate={hover} />}
      <UserAvatar
        name={c.title}
        url={c.avatarUrl}
        stillUrl={user?.avatarStillUrl}
        animate={hover}
        group={c.kind === "group"}
        size={40}
        className="relative"
      />
      <div className="relative flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn("flex-1 min-w-0 text-base", unread > 0 ? "font-extrabold" : "font-semibold")}>
            {user ? <UserName user={user} /> : <span className="truncate block">{c.title}</span>}
          </span>
          {c.muted && <BellOff size={11} className="text-text-faint flex-shrink-0 self-center" aria-label={t("messages.muted")} />}
          <span className="text-xs text-text-faint flex-shrink-0">{formatChatTime(c.lastActivityAt, locale)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("flex-1 truncate text-sm", unread > 0 ? "text-text" : "text-text-dim")}>{preview}</span>
          {c.unreadMentions > 0 && (
            <span className="w-[18px] h-[18px] rounded-pill bg-danger text-white inline-flex items-center justify-center" title={t("messages.mentioned")}>
              <AtSign size={11} />
            </span>
          )}
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-pill bg-accent text-accent-text text-xs font-bold inline-flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
