import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import {
  MAX_DISPLAY_NAME_LENGTH,
  USERNAME_PATTERN,
  getApprovedUser,
  getCurrentUser,
  requireAdmin,
  requireApprovedUser,
  toPublicUser,
} from "./lib";

const vMethod = v.object({ name: v.string(), profile: v.any() });

/** Called by the auth core the first time an account signs up. */
export const createUser = internalMutation({
  args: { method: vMethod },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", { status: "pending", role: "user" });
  },
});

/** Copies the username from the `authUsername` component onto the users row,
 * and makes the ADMIN_USERNAME account (`npx convex env set ADMIN_USERNAME
 * <name>`) an approved admin so the first approval has someone to make it. */
async function syncUsername(ctx: MutationCtx, user: Doc<"users">) {
  const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId: user._id });
  if (username === null) return;
  if (!USERNAME_PATTERN.test(username)) {
    // The login screen only sends valid usernames; anything else was sent
    // around it, so the account never gets in.
    if (user.status !== "rejected" || user.username !== username) {
      await ctx.db.patch(user._id, { username, status: "rejected" });
    }
    return;
  }
  const isAdmin = username === process.env.ADMIN_USERNAME;
  if (user.username === username && (!isAdmin || user.role === "admin")) return;
  await ctx.db.patch(user._id, {
    username,
    ...(isAdmin ? { role: "admin" as const, status: "approved" as const } : {}),
  });
}

/** Runs on every sign-in. On sign-up it runs before the username is stored,
 * so the client also calls `syncProfile` once it has a session. */
export const onSignIn = internalMutation({
  args: { method: vMethod, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (user !== null) await syncUsername(ctx, user);
    return null;
  },
});

export const syncProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user !== null) await syncUsername(ctx, user);
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return {
      ...(await toPublicUser(ctx, user)),
      status: user.status,
      role: user.role,
    };
  },
});

export const setDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const user = await requireApprovedUser(ctx);
    const trimmed = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    await ctx.db.patch(user._id, { displayName: trimmed || undefined });
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireApprovedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireApprovedUser(ctx);
    const meta = await ctx.db.system.get(storageId);
    const isSticker = (await ctx.db.query("stickers").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first()) !== null;
    if (isSticker) throw new ConvexError("INVALID_IMAGE");
    if (meta === null || !meta.contentType?.startsWith("image/") || meta.size > 2 * 1024 * 1024) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("INVALID_IMAGE");
    }
    if (user.avatarId) await ctx.storage.delete(user.avatarId);
    await ctx.db.patch(user._id, { avatarId: storageId });
  },
});

export const removeAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    if (!user.avatarId) return;
    await ctx.storage.delete(user.avatarId);
    await ctx.db.patch(user._id, { avatarId: undefined });
  },
});

// --- Admin: access requests -------------------------------------------------

export const listAccessRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await getApprovedUser(ctx);
    if (me === null || me.role !== "admin") return [];
    const pending = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);
    return await Promise.all(
      pending.map(async (u) => ({ ...(await toPublicUser(ctx, u)), requestedAt: u._creationTime }))
    );
  },
});

export const reviewAccessRequest = mutation({
  args: { userId: v.id("users"), approve: v.boolean() },
  handler: async (ctx, { userId, approve }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (user === null || user.status !== "pending") throw new ConvexError("NOT_PENDING");
    await ctx.db.patch(userId, { status: approve ? "approved" : "rejected" });
  },
});
