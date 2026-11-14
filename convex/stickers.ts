import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  MAX_STICKERS_PER_USER,
  MAX_STICKER_BYTES,
  MESSAGE_TTL_MS,
  getApprovedUser,
  requireApprovedUser,
  requireMembership,
} from "./lib";

const STICKER_TYPES = new Set(["image/webp", "image/png"]);

async function countStickers(ctx: MutationCtx, ownerId: Id<"users">) {
  const rows = await ctx.db
    .query("stickers")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(MAX_STICKERS_PER_USER);
  return rows.length;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const me = await getApprovedUser(ctx);
    if (me === null) return [];
    const rows = await ctx.db
      .query("stickers")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .order("desc")
      .take(MAX_STICKERS_PER_USER);
    const withUrls = await Promise.all(
      rows.map(async (s) => ({ _id: s._id, storageId: s.storageId, url: await ctx.storage.getUrl(s.storageId) }))
    );
    return withUrls.filter((s) => s.url !== null) as { _id: Id<"stickers">; storageId: Id<"_storage">; url: string }[];
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireApprovedUser(ctx);
    if ((await countStickers(ctx, me._id)) >= MAX_STICKERS_PER_USER) throw new ConvexError("STICKER_LIMIT");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Adds a sticker the user just made in the editor and uploaded. */
export const create = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const me = await requireApprovedUser(ctx);
    const meta = await ctx.db.system.get(storageId);
    const valid = meta !== null && STICKER_TYPES.has(meta.contentType ?? "") && meta.size <= MAX_STICKER_BYTES;
    // A file nobody references yet is the one just uploaded; any other is
    // someone else's sticker, which has to be saved from a message instead.
    const alreadyUsed = (await ctx.db.query("stickers").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first()) !== null;
    if (!valid || alreadyUsed) {
      if (!alreadyUsed && meta !== null) await ctx.storage.delete(storageId);
      throw new ConvexError("INVALID_STICKER");
    }
    if ((await countStickers(ctx, me._id)) >= MAX_STICKERS_PER_USER) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("STICKER_LIMIT");
    }
    return await ctx.db.insert("stickers", { ownerId: me._id, storageId });
  },
});

/** Saves a sticker someone sent in a chat into my own collection. */
export const saveFromMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const me = await requireApprovedUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null || message.stickerStorageId === undefined) throw new ConvexError("NOT_A_STICKER");
    await requireMembership(ctx, message.conversationId, me._id);
    const storageId = message.stickerStorageId;

    const existing = await ctx.db
      .query("stickers")
      .withIndex("by_owner_storage", (q) => q.eq("ownerId", me._id).eq("storageId", storageId))
      .first();
    if (existing !== null) throw new ConvexError("ALREADY_SAVED");
    if ((await countStickers(ctx, me._id)) >= MAX_STICKERS_PER_USER) throw new ConvexError("STICKER_LIMIT");
    if ((await ctx.db.system.get(storageId)) === null) throw new ConvexError("NOT_A_STICKER");
    return await ctx.db.insert("stickers", { ownerId: me._id, storageId });
  },
});

export const remove = mutation({
  args: { stickerId: v.id("stickers") },
  handler: async (ctx, { stickerId }) => {
    const me = await requireApprovedUser(ctx);
    const sticker = await ctx.db.get(stickerId);
    if (sticker === null || sticker.ownerId !== me._id) throw new ConvexError("NOT_YOUR_STICKER");
    await ctx.db.delete(stickerId);
    // Messages already sent with it keep showing it until they expire, so
    // the file outlives the row by the message lifetime.
    await ctx.scheduler.runAfter(MESSAGE_TTL_MS + 60 * 60 * 1000, internal.stickers.deleteFileIfUnused, {
      storageId: sticker.storageId,
    });
  },
});

export const deleteFileIfUnused = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const stillUsed = await ctx.db.query("stickers").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first();
    if (stillUsed === null && (await ctx.db.system.get(storageId)) !== null) {
      await ctx.storage.delete(storageId);
    }
  },
});
