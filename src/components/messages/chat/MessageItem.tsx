import { useState, type KeyboardEvent, type ReactNode } from "react";
import { BookmarkPlus, CornerUpLeft, Pencil, SmilePlus, Trash2 } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { UserName } from "@/components/user/UserName";
import { formatChatTime, formatRemaining } from "@/lib/chatTime";
import { REACTION_EMOJIS } from "@/lib/reactions";
import { cn } from "@/lib/cn";
import { VoicePlayer } from "./VoicePlayer";
import { TradeOfferCard } from "./TradeOfferCard";

export type ChatMessage = FunctionReturnType<typeof api.messages.list>[number];
type Member = NonNullable<FunctionReturnType<typeof api.conversations.get>>["members"][number];

const KIND_LABEL: Record<string, TranslationKey> = {
  gif: "messages.gifPreview",
  sticker: "messages.stickerPreview",
  voice: "messages.voicePreview",
  image: "messages.imagePreview",
};

interface MessageItemProps {
  m: ChatMessage;
  startsGroup: boolean;
  myId: string;
  members: Map<string, Member>;
  canModerate: boolean;
  now: number;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage, body: string) => Promise<void>;
  onDelete: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onSaveSticker: (m: ChatMessage) => void;
  onOpenImage: (url: string) => void;
  onOpenProfile: (userId: string) => void;
  onJumpTo: (messageId: string) => void;
}

/** Highlights @username tokens that belong to members of the chat. */
function renderBody(body: string, usernames: Set<string>): ReactNode[] {
  return body.split(/(@[a-z0-9_.]{3,20})/gi).map((part, i) =>
    part.startsWith("@") && usernames.has(part.slice(1).toLowerCase()) ? (
      <span key={i} className="px-0.5 rounded-sm bg-accent/20 text-accent font-semibold">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function MessageItem({
  m,
  startsGroup,
  myId,
  members,
  canModerate,
  now,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onSaveSticker,
  onOpenImage,
  onOpenProfile,
  onJumpTo,
}: MessageItemProps) {
  const { t, locale } = useLocale();
  const [hover, setHover] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const mine = m.authorId === myId;
  const author = members.get(m.authorId);
  const mentionsMe = m.mentions.includes(myId as never);
  const usernames = new Set([...members.values()].map((u) => u.username));
  const optimistic = m._id.startsWith("optimistic-");
  const canEdit = mine && !m.gif && !m.stickerUrl && !m.voice;
  const showToolbar = hover && editing === null && !optimistic;

  function nameOf(userId: string) {
    return userId === myId ? t("messages.you") : (members.get(userId)?.displayName ?? "?");
  }

  async function saveEdit() {
    if (editing === null) return;
    await onEdit(m, editing);
    setEditing(null);
  }

  function handleEditKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void saveEdit();
    } else if (e.key === "Escape") {
      setEditing(null);
    }
  }

  return (
    <div
      id={`msg-${m._id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPicking(false);
      }}
      // Touch screens have no hover: a tap on the message shows its actions.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a, textarea, audio")) setHover(true);
      }}
      title={t("messages.expiresIn", { time: formatRemaining(m.expiresAt - now) })}
      className={cn(
        "relative flex gap-3 rounded-md px-2 -mx-2 transition-colors",
        startsGroup || m.replyTo ? "mt-3 first:mt-0 pt-0.5" : "mt-0",
        mentionsMe ? "bg-[rgba(250,190,40,0.09)] border-l-2 border-[#f0b232]" : "hover:bg-surface-alt/40",
        optimistic && "opacity-70"
      )}
    >
      <div className="w-9 flex-shrink-0">
        {(startsGroup || m.replyTo) && (
          <button type="button" onClick={() => onOpenProfile(m.authorId)} className="cursor-pointer rounded-full mt-0.5">
            <UserAvatar
              name={author?.displayName ?? "?"}
              url={author?.avatarUrl ?? null}
              stillUrl={author?.avatarStillUrl}
              animate={hover}
              size={36}
            />
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0 pb-0.5">
        {m.replyTo && (
          <button
            type="button"
            onClick={() => onJumpTo(m.replyTo!._id)}
            className="flex items-center gap-1.5 text-xs text-text-dim hover:text-text cursor-pointer max-w-full mb-0.5"
          >
            <CornerUpLeft size={12} className="flex-shrink-0" />
            <span className="font-bold flex-shrink-0">{nameOf(m.replyTo.authorId)}</span>
            <span className="truncate">{m.replyTo.kind === "text" ? m.replyTo.body : t(KIND_LABEL[m.replyTo.kind])}</span>
          </button>
        )}
        {(startsGroup || m.replyTo) && (
          <div className="flex items-baseline gap-2 min-w-0">
            <button type="button" onClick={() => onOpenProfile(m.authorId)} className="cursor-pointer min-w-0 text-left font-bold text-base">
              {author ? <UserName user={author} /> : "?"}
            </button>
            <span className="text-xs text-text-faint flex-shrink-0">{formatChatTime(m.sentAt, locale)}</span>
          </div>
        )}

        {editing !== null ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              onKeyDown={handleEditKey}
              rows={Math.min(6, editing.split("\n").length)}
              maxLength={2000}
              className="w-full resize-none bg-input-bg border border-accent rounded-md px-3 py-2 text-base outline-none"
            />
            <div className="text-xs text-text-faint">{t("messages.editHint")}</div>
          </div>
        ) : (
          <>
            {m.gif && (
              <img
                src={m.gif.url}
                alt="GIF"
                loading="lazy"
                className="rounded-md mt-1 max-w-full bg-surface-alt"
                style={{ width: Math.min(260, m.gif.width), aspectRatio: `${m.gif.width} / ${m.gif.height}` }}
              />
            )}
            {m.stickerUrl && <img src={m.stickerUrl} alt="Sticker" loading="lazy" className="w-32 h-32 object-contain mt-1" />}
            {m.voice?.url && <VoicePlayer url={m.voice.url} durationMs={m.voice.durationMs} />}
            {m.image?.url && (
              <button type="button" onClick={() => onOpenImage(m.image!.url!)} className="block mt-1 cursor-zoom-in">
                <img
                  src={m.image.url}
                  alt=""
                  loading="lazy"
                  className="rounded-md max-w-full max-h-[320px] bg-surface-alt object-contain"
                  style={{ width: Math.min(320, m.image.width), aspectRatio: `${m.image.width} / ${m.image.height}` }}
                />
              </button>
            )}
            {m.body && (
              <div className="text-base whitespace-pre-wrap break-words leading-relaxed">
                {renderBody(m.body, usernames)}
                {m.editedAt && <span className="text-xs text-text-faint ml-1.5">{t("messages.edited")}</span>}
              </div>
            )}
            {m.tradeOffer && (
              <TradeOfferCard messageId={m._id} offer={m.tradeOffer} canAnswer={!mine && (members.get(myId)?.isAdmin ?? false)} />
            )}
          </>
        )}

        {m.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(m, r.emoji)}
                title={r.userIds.map(nameOf).join(", ")}
                aria-pressed={r.mine}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-sm cursor-pointer",
                  r.mine ? "bg-accent/15 border-accent text-text" : "bg-surface-alt border-border text-text-dim hover:border-text-faint"
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-bold text-xs">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showToolbar && (
        <div className="absolute -top-3.5 right-2 z-10 flex items-center bg-surface border border-border rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.3)]">
          {picking ? (
            REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onReact(m, e);
                  setPicking(false);
                }}
                className="w-8 h-8 hover:bg-surface-alt cursor-pointer text-md rounded-md"
              >
                {e}
              </button>
            ))
          ) : (
            <>
              <ToolbarButton label={t("messages.react")} onClick={() => setPicking(true)}>
                <SmilePlus size={15} />
              </ToolbarButton>
              <ToolbarButton label={t("messages.reply")} onClick={() => onReply(m)}>
                <CornerUpLeft size={15} />
              </ToolbarButton>
              {canEdit && (
                <ToolbarButton label={t("messages.edit")} onClick={() => setEditing(m.body)}>
                  <Pencil size={14} />
                </ToolbarButton>
              )}
              {!mine && m.stickerUrl && (
                <ToolbarButton label={t("stickers.save")} onClick={() => onSaveSticker(m)}>
                  <BookmarkPlus size={15} />
                </ToolbarButton>
              )}
              {(mine || canModerate) && (
                <ToolbarButton label={t("messages.delete")} onClick={() => onDelete(m)} danger>
                  <Trash2 size={14} />
                </ToolbarButton>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "w-8 h-8 inline-flex items-center justify-center cursor-pointer rounded-md hover:bg-surface-alt",
        danger ? "text-text-dim hover:text-danger" : "text-text-dim hover:text-text"
      )}
    >
      {children}
    </button>
  );
}
