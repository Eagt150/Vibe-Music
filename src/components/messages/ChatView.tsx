import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, BookmarkPlus, Clock, SendHorizontal, Settings2, Smile } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { useNow } from "@/hooks/useNow";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { IconButton } from "@/components/ui/IconButton";
import { formatChatTime, formatRemaining } from "@/lib/chatTime";
import { convexErrorCode } from "@/lib/convexError";
import { MAX_STICKERS } from "@/lib/stickerLimits";
import { cn } from "@/lib/cn";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import { MediaPicker } from "./MediaPicker";
import type { ConversationId } from "./types";

const MAX_LENGTH = 2000;
const MESSAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
// Consecutive messages from one author closer than this share one header.
const GROUP_GAP_MS = 5 * 60 * 1000;

function sendErrorKey(code: string | null): TranslationKey {
  if (code === "RATE_LIMITED") return "messages.errorRateLimited";
  if (code === "MESSAGE_TOO_LONG") return "messages.errorTooLong";
  return "messages.errorSend";
}

interface ChatViewProps {
  conversationId: ConversationId;
  myId: string;
  onBack?: () => void;
  onLeft: () => void;
}

export function ChatView({ conversationId, myId, onBack, onLeft }: ChatViewProps) {
  const { t, locale } = useLocale();
  const conversation = useQuery(api.conversations.get, { conversationId });
  const messages = useQuery(api.messages.list, { conversationId });
  // Show the message right away; the server's copy replaces it a moment later.
  const send = useMutation(api.messages.send).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.messages.list, { conversationId: args.conversationId });
    if (current === undefined) return;
    const sentAt = Date.now();
    store.setQuery(api.messages.list, { conversationId: args.conversationId }, [
      ...current,
      {
        _id: `optimistic-${sentAt}` as Id<"messages">,
        authorId: myId as Id<"users">,
        body: args.body.trim(),
        gif: null,
        stickerUrl: null,
        sentAt,
        expiresAt: sentAt + MESSAGE_TTL_MS,
      },
    ]);
  });
  const markRead = useMutation(api.conversations.markRead);
  const now = useNow();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const saveSticker = useMutation(api.stickers.saveFromMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The server already hides messages older than 3 days, but a chat left open
  // would keep showing them until something else changes — drop them here too.
  const visible = useMemo(() => messages?.filter((m) => m.expiresAt > now) ?? [], [messages, now]);
  const lastId = visible[visible.length - 1]?._id;

  useEffect(() => {
    setDraft("");
    setError(null);
    setPickerOpen(false);
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  async function handleSaveSticker(messageId: Id<"messages">) {
    try {
      await saveSticker({ messageId });
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

  // Removed from the group (or it was deleted) while it was open.
  useEffect(() => {
    if (conversation === null) onLeft();
  }, [conversation, onLeft]);
  if (conversation === null) return null;

  const membersById = new Map(conversation?.members.map((m) => [m._id as string, m]) ?? []);
  const other = conversation?.members.find((m) => m._id !== myId);
  const subtitle =
    conversation?.kind === "group"
      ? t("messages.members", { count: conversation.members.length })
      : other
        ? `@${other.username}`
        : "";

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setDraft("");
    try {
      await send({ conversationId, body });
    } catch (err) {
      setDraft(body);
      setError(t(sendErrorKey(convexErrorCode(err))));
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-3.5 md:px-5 py-3 border-b border-border flex-shrink-0">
        {onBack && (
          <IconButton onClick={onBack} aria-label={t("common.back")}>
            <ArrowLeft size={16} />
          </IconButton>
        )}
        {conversation && (
          <>
            <UserAvatar name={conversation.title} url={conversation.avatarUrl} group={conversation.kind === "group"} size={38} />
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-md truncate">{conversation.title}</div>
              <div className="text-sm text-text-dim truncate">{subtitle}</div>
            </div>
            {conversation.kind === "group" && (
              <IconButton variant="solid" onClick={() => setSettingsOpen(true)} aria-label={t("messages.groupSettings")}>
                <Settings2 size={15} />
              </IconButton>
            )}
          </>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 md:px-5 py-4">
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
            const mine = m.authorId === myId;
            const author = membersById.get(m.authorId);
            const name = mine ? t("messages.you") : (author?.displayName ?? "?");
            return (
              <div
                key={m._id}
                className={cn("flex gap-3 group", startsGroup ? "mt-3 first:mt-0" : "mt-0.5")}
                title={t("messages.expiresIn", { time: formatRemaining(m.expiresAt - now) })}
              >
                <div className="w-9 flex-shrink-0">
                  {startsGroup && <UserAvatar name={author?.displayName ?? "?"} url={author?.avatarUrl ?? null} size={36} />}
                </div>
                <div className="flex-1 min-w-0">
                  {startsGroup && (
                    <div className="flex items-baseline gap-2">
                      <span className={cn("font-bold text-base", mine && "text-accent")}>{name}</span>
                      <span className="text-xs text-text-faint">{formatChatTime(m.sentAt, locale)}</span>
                    </div>
                  )}
                  {m.gif ? (
                    <img
                      src={m.gif.url}
                      alt="GIF"
                      loading="lazy"
                      className="rounded-md mt-1 max-w-full bg-surface-alt"
                      style={{ width: Math.min(260, m.gif.width), aspectRatio: `${m.gif.width} / ${m.gif.height}` }}
                    />
                  ) : m.stickerUrl ? (
                    <div className="flex items-end gap-1.5 mt-1">
                      <img src={m.stickerUrl} alt="Sticker" loading="lazy" className="w-32 h-32 object-contain" />
                      {!mine && (
                        <button
                          type="button"
                          onClick={() => void handleSaveSticker(m._id)}
                          title={t("stickers.save")}
                          aria-label={t("stickers.save")}
                          className="p-1.5 rounded-full text-text-dim hover:text-accent hover:bg-surface-alt cursor-pointer opacity-60 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <BookmarkPlus size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-base whitespace-pre-wrap break-words leading-relaxed">{m.body}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-3.5 md:px-5 pb-3 pt-2 flex-shrink-0 relative">
        {pickerOpen && (
          <MediaPicker
            conversationId={conversationId}
            myId={myId}
            onClose={() => setPickerOpen(false)}
            onError={setError}
          />
        )}
        {notice && <div className="text-sm text-accent mb-1.5">{notice}</div>}
        {error && <div className="text-sm text-danger mb-1.5">{error}</div>}
        <div className="flex items-end gap-2 bg-input-bg border border-border rounded-lg pl-1.5 pr-1.5 py-1.5 focus-within:border-accent">
          <IconButton
            type="button"
            active={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label={t("messages.openMedia")}
            title={t("messages.openMedia")}
          >
            <Smile size={17} />
          </IconButton>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("messages.placeholder", { name: conversation?.title ?? "" })}
            className="flex-1 resize-none bg-transparent outline-none text-base py-1.5 max-h-40 placeholder:text-text-faint"
          />
          <IconButton type="submit" active={draft.trim().length > 0} disabled={!draft.trim()} aria-label={t("messages.send")}>
            <SendHorizontal size={15} />
          </IconButton>
        </div>
      </form>

      {settingsOpen && conversation && (
        <GroupSettingsDialog conversation={conversation} myId={myId} onClose={() => setSettingsOpen(false)} onLeft={onLeft} />
      )}
    </div>
  );
}
