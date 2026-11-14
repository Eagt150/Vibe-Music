import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  KLIPY_MEDIA_PREFIX,
  MAX_MESSAGE_LENGTH,
  MESSAGE_TTL_MS,
  getApprovedUser,
  getMembership,
  requireApprovedUser,
  requireMembership,
} from "./lib";

const PAGE_SIZE = 200;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX = 10;
const PURGE_BATCH = 500;

/** Messages of the last 3 days, oldest first. Older ones are hidden here even
 * before the hourly purge gets to them. */
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getApprovedUser(ctx);
    if (me === null || (await getMembership(ctx, conversationId, me._id)) === null) return [];
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    const latest = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId).gt("_creationTime", cutoff))
      .order("desc")
      .take(PAGE_SIZE);
    return await Promise.all(
      latest.reverse().map(async (m) => ({
        _id: m._id,
        authorId: m.authorId,
        body: m.body,
        gif: m.gif ? { url: m.gif.url, width: m.gif.width, height: m.gif.height } : null,
        stickerUrl: m.stickerStorageId ? await ctx.storage.getUrl(m.stickerStorageId) : null,
        sentAt: m._creationTime,
        expiresAt: m._creationTime + MESSAGE_TTL_MS,
      }))
    );
  },
});

/** Shared by the three kinds of message: membership, rate limit, insert. */
async function insertMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  content: Pick<Doc<"messages">, "body" | "gif" | "stickerStorageId">
) {
  const me = await requireApprovedUser(ctx);
  const membership = await requireMembership(ctx, conversationId, me._id);

  const recent = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("authorId", me._id).gt("_creationTime", Date.now() - RATE_LIMIT_WINDOW_MS))
    .take(RATE_LIMIT_MAX);
  if (recent.length >= RATE_LIMIT_MAX) throw new ConvexError("RATE_LIMITED");

  await ctx.db.insert("messages", { conversationId, authorId: me._id, ...content });
  // Sending counts as reading everything up to now.
  await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
  return me;
}

export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string() },
  handler: async (ctx, { conversationId, body }) => {
    const text = body.trim();
    if (!text) throw new ConvexError("EMPTY_MESSAGE");
    if (text.length > MAX_MESSAGE_LENGTH) throw new ConvexError("MESSAGE_TOO_LONG");
    await insertMessage(ctx, conversationId, { body: text });
  },
});

export const sendGif = mutation({
  args: {
    conversationId: v.id("conversations"),
    gif: v.object({ slug: v.string(), url: v.string(), width: v.number(), height: v.number() }),
  },
  handler: async (ctx, { conversationId, gif }) => {
    if (!gif.url.startsWith(KLIPY_MEDIA_PREFIX) || gif.url.length > 1000 || gif.slug.length > 200) {
      throw new ConvexError("INVALID_GIF");
    }
    const width = Math.min(Math.max(Math.round(gif.width), 1), 2000);
    const height = Math.min(Math.max(Math.round(gif.height), 1), 2000);
    await insertMessage(ctx, conversationId, { body: "", gif: { ...gif, width, height } });
  },
});

export const sendSticker = mutation({
  args: { conversationId: v.id("conversations"), stickerId: v.id("stickers") },
  handler: async (ctx, { conversationId, stickerId }) => {
    const me = await requireApprovedUser(ctx);
    const sticker = await ctx.db.get(stickerId);
    if (sticker === null || sticker.ownerId !== me._id) throw new ConvexError("NOT_YOUR_STICKER");
    await insertMessage(ctx, conversationId, { body: "", stickerStorageId: sticker.storageId });
  },
});

/** Deletes messages older than 3 days, in batches. Scheduled hourly by
 * convex/crons.ts and re-schedules itself while there is a backlog. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    const expired = await ctx.db
      .query("messages")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(PURGE_BATCH);
    for (const m of expired) await ctx.db.delete(m._id);
    if (expired.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.messages.purgeExpired, {});
    }
    return expired.length;
  },
});
