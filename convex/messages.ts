import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  KLIPY_MEDIA_PREFIX,
  MAX_CHAT_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_VOICE_BYTES,
  MAX_VOICE_MS,
  MESSAGE_TTL_MS,
  deleteMessageCascade,
  getApprovedUser,
  getMembership,
  requireApprovedUser,
  requireMembership,
} from "./lib";

const PAGE_SIZE = 200;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 10;
const PURGE_BATCH = 200;
const REPLY_PREVIEW_LENGTH = 120;

/** The reactions offered in the message menu. Kept to a fixed set so a
 * message can't collect hundreds of different ones. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"] as const;

type MessageKind = "text" | "gif" | "sticker" | "voice" | "image";

function kindOf(m: Doc<"messages">): MessageKind {
  if (m.gif) return "gif";
  if (m.stickerStorageId) return "sticker";
  if (m.voice) return "voice";
  if (m.image) return "image";
  return "text";
}

/** Messages of the last 3 days, oldest first. Older ones are hidden here even
 * before the hourly purge gets to them. */
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getApprovedUser(ctx);
    if (me === null || (await getMembership(ctx, conversationId, me._id)) === null) return [];
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    const latest = (
      await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId).gt("_creationTime", cutoff))
        .order("desc")
        .take(PAGE_SIZE)
    ).reverse();

    // All reactions of the chat in one read, grouped per message.
    const reactionRows = await ctx.db
      .query("reactions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const reactionsByMessage = new Map<string, Map<string, Id<"users">[]>>();
    for (const r of reactionRows) {
      const perEmoji = reactionsByMessage.get(r.messageId) ?? new Map<string, Id<"users">[]>();
      perEmoji.set(r.emoji, [...(perEmoji.get(r.emoji) ?? []), r.userId]);
      reactionsByMessage.set(r.messageId, perEmoji);
    }

    const byId = new Map(latest.map((m) => [m._id as string, m]));
    return await Promise.all(
      latest.map(async (m) => {
        // A reply can point at a message older than this page, or one that
        // was deleted — then it simply shows no quote.
        const original = m.replyToId ? (byId.get(m.replyToId) ?? (await ctx.db.get(m.replyToId))) : null;
        const perEmoji = reactionsByMessage.get(m._id);
        return {
          _id: m._id,
          authorId: m.authorId,
          body: m.body,
          gif: m.gif ? { url: m.gif.url, width: m.gif.width, height: m.gif.height } : null,
          stickerUrl: m.stickerStorageId ? await ctx.storage.getUrl(m.stickerStorageId) : null,
          voice: m.voice ? { url: await ctx.storage.getUrl(m.voice.storageId), durationMs: m.voice.durationMs } : null,
          image: m.image
            ? { url: await ctx.storage.getUrl(m.image.storageId), width: m.image.width, height: m.image.height }
            : null,
          replyTo:
            original && original._creationTime > cutoff
              ? {
                  _id: original._id,
                  authorId: original.authorId,
                  kind: kindOf(original),
                  body: original.body.slice(0, REPLY_PREVIEW_LENGTH),
                }
              : null,
          editedAt: m.editedAt ?? null,
          mentions: m.mentions ?? [],
          reactions: perEmoji
            ? [...perEmoji.entries()].map(([emoji, userIds]) => ({
                emoji,
                count: userIds.length,
                mine: userIds.includes(me._id),
                userIds,
              }))
            : [],
          sentAt: m._creationTime,
          expiresAt: m._creationTime + MESSAGE_TTL_MS,
        };
      })
    );
  },
});

/** @usernames in the text that belong to members of this chat. */
async function resolveMentions(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  authorId: Id<"users">,
  text: string
): Promise<Id<"users">[] | undefined> {
  const names = new Set([...text.matchAll(/@([a-z0-9_.]{3,20})/gi)].map((m) => m[1].toLowerCase()));
  if (names.size === 0) return undefined;
  const members = await ctx.db
    .query("members")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  const ids: Id<"users">[] = [];
  for (const member of members) {
    if (member.userId === authorId) continue;
    const user = await ctx.db.get(member.userId);
    if (user?.username && names.has(user.username)) ids.push(user._id);
  }
  return ids.length > 0 ? ids : undefined;
}

type Content = Pick<Doc<"messages">, "body" | "gif" | "stickerStorageId" | "voice" | "image">;

/** Shared by every kind of message: membership, rate limit, reply check,
 * mentions, insert. */
async function insertMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  content: Content,
  replyToId: Id<"messages"> | undefined
) {
  const me = await requireApprovedUser(ctx);
  const membership = await requireMembership(ctx, conversationId, me._id);

  const recent = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("authorId", me._id).gt("_creationTime", Date.now() - RATE_LIMIT_WINDOW_MS))
    .take(RATE_LIMIT_MAX);
  if (recent.length >= RATE_LIMIT_MAX) throw new ConvexError("RATE_LIMITED");

  if (replyToId) {
    const original = await ctx.db.get(replyToId);
    if (original === null || original.conversationId !== conversationId) throw new ConvexError("INVALID_REPLY");
  }

  const mentions = content.body ? await resolveMentions(ctx, conversationId, me._id, content.body) : undefined;
  await ctx.db.insert("messages", { conversationId, authorId: me._id, ...content, replyToId, mentions });
  // Sending counts as reading everything up to now, and ends "is typing".
  await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
  const typing = await ctx.db
    .query("typing")
    .withIndex("by_conversation_user", (q) => q.eq("conversationId", conversationId).eq("userId", me._id))
    .unique();
  if (typing) await ctx.db.delete(typing._id);
  return me;
}

function cleanText(body: string): string {
  const text = body.trim();
  if (!text) throw new ConvexError("EMPTY_MESSAGE");
  if (text.length > MAX_MESSAGE_LENGTH) throw new ConvexError("MESSAGE_TOO_LONG");
  return text;
}

const vReplyTo = v.optional(v.id("messages"));

export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string(), replyToId: vReplyTo },
  handler: async (ctx, { conversationId, body, replyToId }) => {
    await insertMessage(ctx, conversationId, { body: cleanText(body) }, replyToId);
  },
});

export const sendGif = mutation({
  args: {
    conversationId: v.id("conversations"),
    gif: v.object({ slug: v.string(), url: v.string(), width: v.number(), height: v.number() }),
    replyToId: vReplyTo,
  },
  handler: async (ctx, { conversationId, gif, replyToId }) => {
    if (!gif.url.startsWith(KLIPY_MEDIA_PREFIX) || gif.url.length > 1000 || gif.slug.length > 200) {
      throw new ConvexError("INVALID_GIF");
    }
    const width = Math.min(Math.max(Math.round(gif.width), 1), 2000);
    const height = Math.min(Math.max(Math.round(gif.height), 1), 2000);
    await insertMessage(ctx, conversationId, { body: "", gif: { ...gif, width, height } }, replyToId);
  },
});

export const sendSticker = mutation({
  args: { conversationId: v.id("conversations"), stickerId: v.id("stickers"), replyToId: vReplyTo },
  handler: async (ctx, { conversationId, stickerId, replyToId }) => {
    const me = await requireApprovedUser(ctx);
    const sticker = await ctx.db.get(stickerId);
    if (sticker === null || sticker.ownerId !== me._id) throw new ConvexError("NOT_YOUR_STICKER");
    await insertMessage(ctx, conversationId, { body: "", stickerStorageId: sticker.storageId }, replyToId);
  },
});

/** Upload URL for a voice note or a photo sent in a chat. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireApprovedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

async function requireUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  typePrefix: "audio/" | "image/",
  maxBytes: number
) {
  const meta = await ctx.db.system.get(storageId);
  const isSticker =
    (await ctx.db.query("stickers").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first()) !== null;
  if (isSticker || meta === null || !(meta.contentType ?? "").startsWith(typePrefix) || meta.size > maxBytes) {
    if (!isSticker && meta !== null) await ctx.storage.delete(storageId);
    throw new ConvexError(typePrefix === "audio/" ? "INVALID_VOICE" : "INVALID_IMAGE");
  }
}

export const sendVoice = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
    durationMs: v.number(),
    replyToId: vReplyTo,
  },
  handler: async (ctx, { conversationId, storageId, durationMs, replyToId }) => {
    await requireUpload(ctx, storageId, "audio/", MAX_VOICE_BYTES);
    // A little slack over 60 s for the recorder stopping a beat late.
    if (!(durationMs > 0) || durationMs > MAX_VOICE_MS + 1500) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("INVALID_VOICE");
    }
    await insertMessage(
      ctx,
      conversationId,
      { body: "", voice: { storageId, durationMs: Math.min(Math.round(durationMs), MAX_VOICE_MS) } },
      replyToId
    );
  },
});

export const sendImage = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    caption: v.optional(v.string()),
    replyToId: vReplyTo,
  },
  handler: async (ctx, { conversationId, storageId, width, height, caption, replyToId }) => {
    await requireUpload(ctx, storageId, "image/", MAX_CHAT_IMAGE_BYTES);
    const body = caption?.trim() ?? "";
    if (body.length > MAX_MESSAGE_LENGTH) throw new ConvexError("MESSAGE_TOO_LONG");
    const clamp = (n: number) => Math.min(Math.max(Math.round(n), 1), 10000);
    await insertMessage(
      ctx,
      conversationId,
      { body, image: { storageId, width: clamp(width), height: clamp(height) } },
      replyToId
    );
  },
});

/** Text messages can be edited by their author. */
export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  handler: async (ctx, { messageId, body }) => {
    const me = await requireApprovedUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null || message.authorId !== me._id) throw new ConvexError("NOT_YOUR_MESSAGE");
    if (kindOf(message) !== "text" && !message.image) throw new ConvexError("NOT_EDITABLE");
    const text = message.image ? body.trim() : cleanText(body);
    if (text.length > MAX_MESSAGE_LENGTH) throw new ConvexError("MESSAGE_TOO_LONG");
    if (text === message.body) return;
    await ctx.db.patch(messageId, {
      body: text,
      editedAt: Date.now(),
      mentions: text ? await resolveMentions(ctx, message.conversationId, me._id, text) : undefined,
    });
  },
});

/** Deletes a message for everyone, leaving no trace. Allowed for its author,
 * and for a group's admins on any message of that group. */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await requireApprovedUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null) return;
    if (message.authorId !== me._id) {
      const conversation = await ctx.db.get(message.conversationId);
      const membership = await getMembership(ctx, message.conversationId, me._id);
      if (conversation?.kind !== "group" || membership?.role !== "admin") throw new ConvexError("NOT_ALLOWED");
    }
    await deleteMessageCascade(ctx, message);
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const me = await requireApprovedUser(ctx);
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) throw new ConvexError("INVALID_REACTION");
    const message = await ctx.db.get(messageId);
    if (message === null) throw new ConvexError("NOT_FOUND");
    await requireMembership(ctx, message.conversationId, me._id);
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_user_emoji", (q) => q.eq("messageId", messageId).eq("userId", me._id).eq("emoji", emoji))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    else await ctx.db.insert("reactions", { messageId, conversationId: message.conversationId, userId: me._id, emoji });
  },
});

/** Deletes messages older than 3 days (with their files and reactions) and
 * stale "is typing" rows, in batches. Scheduled hourly by convex/crons.ts and
 * re-schedules itself while there is a backlog. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    const expired = await ctx.db
      .query("messages")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(PURGE_BATCH);
    for (const m of expired) await deleteMessageCascade(ctx, m);

    const staleTyping = await ctx.db
      .query("typing")
      .withIndex("by_until", (q) => q.lt("until", Date.now() - 60_000))
      .take(PURGE_BATCH);
    for (const t of staleTyping) await ctx.db.delete(t._id);

    if (expired.length === PURGE_BATCH || staleTyping.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.messages.purgeExpired, {});
    }
    return expired.length;
  },
});
