import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Bell, BellOff, CandlestickChart, Clock, Settings2, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useLocale } from "@/i18n/LocaleContext";
import { useUiState } from "@/context/UiStateContext";
import { useNow } from "@/hooks/useNow";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserName } from "@/components/user/UserName";
import { Nameplate } from "@/components/user/Nameplate";
import { convexErrorCode } from "@/lib/convexError";
import { cn } from "@/lib/cn";
import { MAX_STICKERS } from "@/lib/stickerLimits";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { PushToggle } from "./trading/PushToggle";
import { MessageItem, type ChatMessage } from "./chat/MessageItem";
import { Composer } from "./chat/Composer";
import type { ConversationId } from "./types";

// The chart library is only needed in the trading bot chat.
const TradingChart = lazy(() => import("./trading/TradingChart").then((m) => ({ default: m.TradingChart })));

// Consecutive messages from one author closer than this share one header.
const GROUP_GAP_MS = 5 * 60 * 1000;

interface ChatViewProps {
  conversationId: ConversationId;
  myId: string;
  onBack?: () => void;
  onLeft: () => void;
}

export function ChatView({ conversationId, myId, onBack, onLeft }: ChatViewProps) {
  const { t } = useLocale();
  const { openProfile } = useUiState();
  const conversation = useQuery(api.conversations.get, { conversationId });
  const messages = useQuery(api.messages.list, { conversationId });
  const typing = useQuery(api.typing.list, { conversationId });
  const markRead = useMutation(api.conversations.markRead);
  const setMuted = useMutation(api.conversations.setMuted);
  const editMessage = useMutation(api.messages.edit);
  const removeMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const saveSticker = useMutation(api.stickers.saveFromMessage);
  const now = useNow();
  const typingNow = useNow(1000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [headerHover, setHeaderHover] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The server already hides messages older than 3 days, but a chat left open
  // would keep showing them until something else changes — drop them here too.
  const visible = useMemo(() => messages?.filter((m) => m.expiresAt > now) ?? [], [messages, now]);
  const lastId = visible[visible.length - 1]?._id;
  const members = useMemo(() => new Map(conversation?.members.map((m) => [m._id as string, m]) ?? []), [conversation]);

  useEffect(() => {
    setReplyTo(null);
  }, [conversationId]);

  // Stick to the bottom and mark as read whenever a new message shows up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (lastId && document.visibilityState === "visible") void markRead({ conversationId });
  }, [lastId, conversationId, markRead]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void markRead({ conversationId });
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversationId, markRead]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  // Removed from the group (or it was deleted) while it was open.
  useEffect(() => {
    if (conversation === null) onLeft();
  }, [conversation, onLeft]);

  const jumpTo = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate([{ backgroundColor: "rgba(47,125,255,0.25)" }, { backgroundColor: "transparent" }], { duration: 1400 });
  }, []);

  if (conversation === null) return null;

  const other = conversation?.members.find((m) => m._id !== myId);
  const headerPlate = conversation?.kind === "direct" && !!other?.nameplateUrl;
  const canModerate = conversation?.kind === "group" && conversation.myRole === "admin";
  const subtitle =
    conversation?.kind === "group"
      ? t("messages.members", { count: conversation.members.length })
      : other
        ? `@${other.username}`
        : "";

  const typers = (typing ?? []).filter((x) => x.until > typingNow);
  const typingText =
    typers.length === 0
      ? null
      : typers.length === 1
        ? t("messages.typingOne", { name: typers[0].displayName })
        : typers.length === 2
          ? t("messages.typingTwo", { a: typers[0].displayName, b: typers[1].displayName })
          : t("messages.typingMany");

  async function handleSaveSticker(m: ChatMessage) {
    try {
      await saveSticker({ messageId: m._id });
      setNotice(t("stickers.saved"));
    } catch (err) {
      const code = convexErrorCode(err);
      setNotice(
        code === "ALREADY_SAVED"
          ? t("stickers.alreadySaved")
          : code === "STICKER_LIMIT"
            ? t("stickers.limit", { max: MAX_STICKERS })
            : t("stickers.errorGeneric")
      );
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        onMouseEnter={() => setHeaderHover(true)}
        onMouseLeave={() => setHeaderHover(false)}
        className={cn(
          "relative flex items-center gap-3 px-3.5 md:px-5 py-3 border-b border-border flex-shrink-0 [&>*:not([aria-hidden])]:relative",
          headerPlate && "[text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
        )}
      >
        {headerPlate && <Nameplate url={other?.nameplateUrl} stillUrl={other?.nameplateStillUrl} animate={headerHover} />}
        {onBack && (
          <IconButton onClick={onBack} aria-label={t("common.back")}>
            <ArrowLeft size={16} />
          </IconButton>
        )}
        {conversation && (
          <>
            <button
              type="button"
              onClick={() => other && conversation.kind === "direct" && openProfile(other._id)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
            >
              <UserAvatar
                name={conversation.title}
                url={conversation.avatarUrl}
                stillUrl={conversation.kind === "direct" ? other?.avatarStillUrl : null}
                group={conversation.kind === "group"}
                size={38}
              />
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-md truncate">
                  {conversation.kind === "direct" && other ? <UserName user={other} /> : conversation.title}
                </div>
                <div className="text-sm text-text-dim truncate">{subtitle}</div>
              </div>
            </button>
            {conversation.kind === "direct" && other?.isBot && (
              <IconButton variant="solid" onClick={() => setChartOpen(true)} aria-label="Gráfico" title="Gráfico de operaciones">
                <CandlestickChart size={15} />
              </IconButton>
            )}
            {conversation.kind === "direct" && other?.isBot && <PushToggle />}
            <IconButton
              variant="solid"
              onClick={() => void setMuted({ conversationId, muted: !conversation.muted })}
              aria-label={conversation.muted ? t("messages.unmute") : t("messages.mute")}
              title={conversation.muted ? t("messages.unmute") : t("messages.mute")}
            >
              {conversation.muted ? <BellOff size={15} /> : <Bell size={15} />}
            </IconButton>
            {conversation.kind === "group" && (
              <IconButton variant="solid" onClick={() => setSettingsOpen(true)} aria-label={t("messages.groupSettings")}>
                <Settings2 size={15} />
              </IconButton>
            )}
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 md:px-5 pt-4 pb-2">
        <div className="flex items-center justify-center gap-1.5 text-xs text-text-faint mb-4">
          <Clock size={12} />
          {t("messages.expiryNote")}
        </div>
        {messages !== undefined && visible.length === 0 && (
          <div className="text-center text-sm text-text-dim py-8">{t("messages.emptyChat")}</div>
        )}
        <div className="flex flex-col">
          {visible.map((m, i) => {
            const prev = visible[i - 1];
            const startsGroup = !prev || prev.authorId !== m.authorId || m.sentAt - prev.sentAt > GROUP_GAP_MS;
            return (
              <MessageItem
                key={m._id}
                m={m}
                startsGroup={startsGroup}
                myId={myId}
                members={members}
                canModerate={canModerate}
                now={now}
                onReply={setReplyTo}
                onEdit={async (msg, body) => {
                  await editMessage({ messageId: msg._id, body });
                }}
                onDelete={setDeleting}
                onReact={(msg, emoji) => void toggleReaction({ messageId: msg._id, emoji })}
                onSaveSticker={(msg) => void handleSaveSticker(msg)}
                onOpenImage={setLightbox}
                onOpenProfile={openProfile}
                onJumpTo={jumpTo}
              />
            );
          })}
        </div>
      </div>

      <div className="h-5 px-3.5 md:px-5 text-xs text-text-dim flex items-center gap-1.5 flex-shrink-0" aria-live="polite">
        {typingText && (
          <>
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-text-dim animate-bounce" />
              <span className="w-1 h-1 rounded-full bg-text-dim animate-bounce [animation-delay:120ms]" />
              <span className="w-1 h-1 rounded-full bg-text-dim animate-bounce [animation-delay:240ms]" />
            </span>
            {typingText}
          </>
        )}
        {!typingText && notice && <span className="text-accent">{notice}</span>}
      </div>

      <Composer
        conversationId={conversationId}
        conversation={conversation}
        myId={myId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {settingsOpen && conversation && (
        <GroupSettingsDialog conversation={conversation} myId={myId} onClose={() => setSettingsOpen(false)} onLeft={onLeft} />
      )}
      {chartOpen && (
        <Suspense fallback={null}>
          <TradingChart onClose={() => setChartOpen(false)} />
        </Suspense>
      )}
      {deleting && (
        <ConfirmDialog
          title={t("messages.deleteConfirmTitle")}
          body={t("messages.deleteConfirmBody")}
          confirmLabel={t("messages.delete")}
          danger
          onConfirm={() => {
            void removeMessage({ messageId: deleting._id });
            if (replyTo?._id === deleting._id) setReplyTo(null);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 z-[90] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-md" />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={t("common.close")}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white inline-flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
