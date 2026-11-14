import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const MESSAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_GROUP_NAME_LENGTH = 50;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_STICKERS_PER_USER = 50;
export const MAX_STICKER_BYTES = 512 * 1024;
export const KLIPY_MEDIA_PREFIX = "https://static.klipy.com/";

// Lowercase letters, digits, "_" and "." — so "@name" is unambiguous to type
// and to search, whatever the user typed at sign-up.
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

type Ctx = QueryCtx | MutationCtx;

export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId<"users">(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/** For queries: null instead of throwing, so a screen that is still
 * subscribed while the user signs out (or gets rejected) just goes empty
 * instead of crashing the page. */
export async function getApprovedUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const user = await getCurrentUser(ctx);
  return user !== null && user.status === "approved" ? user : null;
}

/** Every messaging mutation goes through this: a pending or rejected account
 * has a session (it can see its own status) but no access to anything else. */
export async function requireApprovedUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) throw new ConvexError("NOT_LOGGED_IN");
  if (user.status !== "approved") throw new ConvexError("NOT_APPROVED");
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireApprovedUser(ctx);
  if (user.role !== "admin") throw new ConvexError("NOT_ADMIN");
  return user;
}

export type PublicUser = {
  _id: Id<"users">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function toPublicUser(ctx: Ctx, user: Doc<"users">): Promise<PublicUser> {
  const username = user.username ?? "";
  return {
    _id: user._id,
    username,
    displayName: user.displayName || username,
    avatarUrl: user.avatarId ? await ctx.storage.getUrl(user.avatarId) : null,
  };
}

export function orderedPair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

export async function getFriendship(ctx: Ctx, a: Id<"users">, b: Id<"users">) {
  const [userLow, userHigh] = orderedPair(a, b);
  return await ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) => q.eq("userLow", userLow).eq("userHigh", userHigh))
    .unique();
}

export async function areFriends(ctx: Ctx, a: Id<"users">, b: Id<"users">): Promise<boolean> {
  const friendship = await getFriendship(ctx, a, b);
  return friendship?.status === "accepted";
}

export async function getMembership(ctx: Ctx, conversationId: Id<"conversations">, userId: Id<"users">) {
  return await ctx.db
    .query("members")
    .withIndex("by_conversation_user", (q) => q.eq("conversationId", conversationId).eq("userId", userId))
    .unique();
}

export async function requireMembership(ctx: Ctx, conversationId: Id<"conversations">, userId: Id<"users">) {
  const membership = await getMembership(ctx, conversationId, userId);
  if (membership === null) throw new ConvexError("NOT_A_MEMBER");
  return membership;
}
