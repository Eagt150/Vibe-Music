import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { Check, ImagePlus, Mic, SendHorizontal, Smile, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { IconButton } from "@/components/ui/IconButton";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { UserName } from "@/components/user/UserName";
import { useVoiceRecorder, MAX_VOICE_MS } from "@/hooks/useVoiceRecorder";
import { prepareChatImage } from "@/lib/chatImages";
import { uploadBlob } from "@/lib/profileImages";
import { convexErrorCode } from "@/lib/convexError";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MediaPicker } from "../MediaPicker";
import type { ConversationDetails, ConversationId } from "../types";
import type { ChatMessage } from "./MessageItem";

const MAX_LENGTH = 2000;
const MESSAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const TYPING_PING_MS = 3000;

function sendErrorKey(code: string | null): TranslationKey {
  if (code === "RATE_LIMITED") return "messages.errorRateLimited";
  if (code === "MESSAGE_TOO_LONG") return "messages.errorTooLong";
  return "messages.errorSend";
}

interface ComposerProps {
  conversationId: ConversationId;
  conversation: ConversationDetails | undefined;
  myId: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
}

export function Composer({ conversationId, conversation, myId, replyTo, onCancelReply }: ComposerProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [caret, setCaret] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const lastPingRef = useRef(0);

  const pingTyping = useMutation(api.typing.ping);
  const stopTyping = useMutation(api.typing.stop);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendVoice = useMutation(api.messages.sendVoice);
  const sendImage = useMutation(api.messages.sendImage);
  // Show the message right away; the server's copy replaces it a moment later.
  const send = useMutation(api.messages.send).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.messages.list, { conversationId: args.conversationId });
    if (current === undefined) return;
    const sentAt = Date.now();
    const original = args.replyToId ? current.find((m) => m._id === args.replyToId) : undefined;
    store.setQuery(api.messages.list, { conversationId: args.conversationId }, [
      ...current,
      {
        _id: `optimistic-${sentAt}` as Id<"messages">,
        authorId: myId as Id<"users">,
        body: args.body.trim(),
        gif: null,
        stickerUrl: null,
        voice: null,
        image: null,
        replyTo: original
          ? { _id: original._id, authorId: original.authorId, kind: "text" as const, body: original.body }
          : null,
        editedAt: null,
        mentions: [],
        reactions: [],
        sentAt,
        expiresAt: sentAt + MESSAGE_TTL_MS,
      },
    ]);
  });

  const recorder = useVoiceRecorder((blob, durationMs) => {
    void (async () => {
      setUploading(true);
      setError(null);
      try {
        const storageId = (await uploadBlob(await generateUploadUrl(), blob)) as Id<"_storage">;
        await sendVoice({ conversationId, storageId, durationMs, replyToId: replyTo?._id });
        onCancelReply();
      } catch (err) {
        setError(t(sendErrorKey(convexErrorCode(err))));
      } finally {
        setUploading(false);
      }
    })();
  });

  useEffect(() => {
    setDraft("");
    setError(null);
    setPickerOpen(false);
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  // Stop showing "is typing" when leaving the chat.
  useEffect(
    () => () => {
      if (Date.now() - lastPingRef.current < 6000) void stopTyping({ conversationId }).catch(() => {});
    },
    [conversationId, stopTyping]
  );

  // --- @mention suggestions (groups) ---
  const mentionQuery = useMemo(() => {
    if (conversation?.kind !== "group") return null;
    const match = /(?:^|\s)@([a-z0-9_.]*)$/i.exec(draft.slice(0, caret));
    return match ? match[1].toLowerCase() : null;
  }, [draft, caret, conversation?.kind]);
  const suggestions = useMemo(() => {
    if (mentionQuery === null || !conversation) return [];
    return conversation.members
      .filter((m) => m._id !== myId)
      .filter((m) => m.username.startsWith(mentionQuery) || m.displayName.toLowerCase().startsWith(mentionQuery))
      .slice(0, 6);
  }, [mentionQuery, conversation, myId]);

  function insertMention(username: string) {
    const before = draft.slice(0, caret).replace(/@([a-z0-9_.]*)$/i, `@${username} `);
    const next = before + draft.slice(caret);
    setDraft(next);
    setCaret(before.length);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(before.length, before.length);
    });
  }

  function handleChange(value: string, position: number) {
    setDraft(value);
    setCaret(position);
    setMentionIndex(0);
    const now = Date.now();
    if (value.trim() && now - lastPingRef.current > TYPING_PING_MS) {
      lastPingRef.current = now;
      void pingTyping({ conversationId }).catch(() => {});
    } else if (!value.trim() && lastPingRef.current) {
      lastPingRef.current = 0;
      void stopTyping({ conversationId }).catch(() => {});
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setDraft("");
    lastPingRef.current = 0;
    const replyToId = replyTo?._id;
    onCancelReply();
    try {
      await send({ conversationId, body, replyToId });
    } catch (err) {
      setDraft(body);
      setError(t(sendErrorKey(convexErrorCode(err))));
    }
  }

  async function handlePhoto(files: FileList) {
    const file = files[0];
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t("profile.errorImage"));
    setUploading(true);
    try {
      const { blob, width, height } = await prepareChatImage(file);
      const storageId = (await uploadBlob(await generateUploadUrl(), blob)) as Id<"_storage">;
      // Whatever is typed goes along as the caption.
      const caption = draft.trim() || undefined;
      await sendImage({ conversationId, storageId, width, height, caption, replyToId: replyTo?._id });
      if (caption) setDraft("");
      onCancelReply();
    } catch (err) {
      setError((err as Error).message === "TOO_BIG" ? t("messages.errorImageTooBig") : t(sendErrorKey(convexErrorCode(err))));
    } finally {
      setUploading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setMentionIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[mentionIndex].username);
        return;
      }
    }
    if (e.key === "Escape" && replyTo) onCancelReply();
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const recording = recorder.state === "recording";
  const replyAuthor = replyTo ? conversation?.members.find((m) => m._id === replyTo.authorId) : undefined;
  const micError =
    recorder.error === "denied" ? t("messages.micDenied") : recorder.error === "unsupported" ? t("messages.micUnsupported") : null;

  return (
    <form onSubmit={handleSubmit} className="px-3.5 md:px-5 pb-3 pt-1 flex-shrink-0 relative">
      {pickerOpen && (
        <MediaPicker
          conversationId={conversationId}
          myId={myId}
          replyToId={replyTo?._id}
          onClose={() => setPickerOpen(false)}
          onSent={onCancelReply}
          onError={setError}
        />
      )}

      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3.5 right-3.5 md:left-5 md:right-auto md:w-[320px] mb-1 bg-surface border border-border rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.35)] p-1 z-20">
          <div className="text-xs font-bold text-text-faint px-2 pt-1 pb-1.5 uppercase tracking-wide">{t("messages.mentionTitle")}</div>
          {suggestions.map((u, i) => (
            <button
              key={u._id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u.username);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-left",
                i === mentionIndex ? "bg-surface-alt" : "hover:bg-surface-alt/60"
              )}
            >
              <UserAvatar name={u.displayName} url={u.avatarUrl} stillUrl={u.avatarStillUrl} size={24} />
              <UserName user={u} className="font-bold text-sm" decorations={false} />
              <span className="text-xs text-text-faint">@{u.username}</span>
            </button>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="flex items-center gap-2 text-sm text-text-dim bg-surface-alt rounded-t-lg px-3.5 py-1.5 border border-b-0 border-border">
          <span className="flex-1 truncate">
            {t("messages.replyingTo")}{" "}
            <span className="font-bold text-text">{replyTo.authorId === myId ? t("messages.you") : (replyAuthor?.displayName ?? "")}</span>
          </span>
          <button type="button" onClick={onCancelReply} aria-label={t("common.cancel")} className="cursor-pointer hover:text-text">
            <X size={14} />
          </button>
        </div>
      )}
      {(error || micError) && <div className="text-sm text-danger mb-1.5">{error ?? micError}</div>}

      <HiddenFileInput ref={photoRef} accept="image/png,image/jpeg,image/webp,image/gif" onFiles={(f) => void handlePhoto(f)} />
      <div
        className={cn(
          "flex items-end gap-1 bg-input-bg border border-border px-1.5 py-1.5 focus-within:border-accent",
          replyTo ? "rounded-b-lg" : "rounded-lg"
        )}
      >
        {recording ? (
          <>
            <IconButton type="button" onClick={() => recorder.stop(false)} aria-label={t("common.cancel")} title={t("common.cancel")}>
              <X size={16} />
            </IconButton>
            <div className="flex-1 flex items-center gap-2 py-1.5 px-1 text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
              <span className="tabular-nums font-semibold">
                {formatDuration(recorder.elapsedMs / 1000)} / {formatDuration(MAX_VOICE_MS / 1000)}
              </span>
              <span className="text-text-dim text-sm truncate">{t("messages.recording")}</span>
            </div>
            <IconButton type="button" active onClick={() => recorder.stop(true)} aria-label={t("messages.sendVoice")} title={t("messages.sendVoice")}>
              <Check size={16} />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton
              type="button"
              active={pickerOpen}
              onClick={() => setPickerOpen((v) => !v)}
              aria-label={t("messages.openMedia")}
              title={t("messages.openMedia")}
            >
              <Smile size={17} />
            </IconButton>
            <IconButton
              type="button"
              disabled={uploading}
              onClick={() => photoRef.current?.click()}
              aria-label={t("messages.sendPhoto")}
              title={t("messages.sendPhoto")}
            >
              <ImagePlus size={17} />
            </IconButton>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onKeyDown={handleKeyDown}
              placeholder={uploading ? t("profile.uploading") : t("messages.placeholder", { name: conversation?.title ?? "" })}
              className="flex-1 resize-none bg-transparent outline-none text-base py-1.5 px-1 max-h-40 placeholder:text-text-faint"
            />
            {draft.trim() ? (
              <IconButton type="submit" active aria-label={t("messages.send")}>
                <SendHorizontal size={15} />
              </IconButton>
            ) : (
              <IconButton
                type="button"
                disabled={uploading}
                onClick={() => void recorder.start()}
                aria-label={t("messages.recordVoice")}
                title={t("messages.recordVoice")}
              >
                <Mic size={17} />
              </IconButton>
            )}
          </>
        )}
      </div>
    </form>
  );
}
