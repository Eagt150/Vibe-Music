import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  HEX_COLOR,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  fileUrl,
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
      bio: user.bio ?? "",
      rawDisplayName: user.displayName ?? "",
      cardColor1: user.cardColor1 ?? null,
      cardColor2: user.cardColor2 ?? null,
      hasBanner: user.bannerId !== undefined,
      hasCardBg: user.cardBgId !== undefined,
      bannerUrl: await fileUrl(ctx, user.bannerId),
      bannerStillUrl: await fileUrl(ctx, user.bannerStillId),
      cardBgUrl: await fileUrl(ctx, user.cardBgId),
      cardBgStillUrl: await fileUrl(ctx, user.cardBgStillId),
    };
  },
});

// --- Profile customization ---------------------------------------------------

const IMAGE_SLOTS = {
  avatar: { file: "avatarId", still: "avatarStillId", maxBytes: 4 * 1024 * 1024 },
  banner: { file: "bannerId", still: "bannerStillId", maxBytes: 8 * 1024 * 1024 },
  nameplate: { file: "nameplateId", still: "nameplateStillId", maxBytes: 4 * 1024 * 1024 },
  cardBg: { file: "cardBgId", still: "cardBgStillId", maxBytes: 8 * 1024 * 1024 },
} as const;
const MAX_STILL_BYTES = 1024 * 1024;
const vSlot = v.union(v.literal("avatar"), v.literal("banner"), v.literal("nameplate"), v.literal("cardBg"));

function cleanColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!HEX_COLOR.test(value)) throw new ConvexError("INVALID_COLOR");
  return value.toLowerCase();
}

/** One emoji (a single grapheme with no letters or digits), or nothing. */
function cleanEmoji(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const graphemes =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed)].length
      : 1;
  if (trimmed.length > 16 || graphemes !== 1 || /[\p{L}\p{N}\s]/u.test(trimmed)) throw new ConvexError("INVALID_EMOJI");
  return trimmed;
}

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    bio: v.string(),
    nameColor: v.union(v.string(), v.null()),
    nameColor2: v.union(v.string(), v.null()),
    tagEmoji: v.string(),
    tagText: v.string(),
    cardColor1: v.union(v.string(), v.null()),
    cardColor2: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const tagText = args.tagText.trim().toUpperCase();
    if (tagText && !/^[A-Z0-9]{1,4}$/.test(tagText)) throw new ConvexError("INVALID_TAG");
    const nameColor = cleanColor(args.nameColor);
    await ctx.db.patch(user._id, {
      displayName: args.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) || undefined,
      bio: args.bio.trim().slice(0, MAX_BIO_LENGTH) || undefined,
      nameColor,
      // A gradient needs a start color.
      nameColor2: nameColor ? cleanColor(args.nameColor2) : undefined,
      tagText: tagText || undefined,
      tagEmoji: tagText ? cleanEmoji(args.tagEmoji) : undefined,
      cardColor1: cleanColor(args.cardColor1),
      cardColor2: cleanColor(args.cardColor2),
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireApprovedUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Sets the avatar, banner, nameplate or card background. For an animated
 * GIF the client also uploads `stillId`, its first frame. */
export const setProfileImage = mutation({
  args: { slot: vSlot, storageId: v.id("_storage"), stillId: v.optional(v.id("_storage")) },
  handler: async (ctx, { slot, storageId, stillId }) => {
    const user = await requireApprovedUser(ctx);
    const spec = IMAGE_SLOTS[slot];
    const discard = async () => {
      await ctx.storage.delete(storageId).catch(() => {});
      if (stillId) await ctx.storage.delete(stillId).catch(() => {});
    };
    const meta = await ctx.db.system.get(storageId);
    const stillMeta = stillId ? await ctx.db.system.get(stillId) : null;
    const isSticker =
      (await ctx.db.query("stickers").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first()) !== null;
    const valid =
      !isSticker &&
      meta !== null &&
      (meta.contentType ?? "").startsWith("image/") &&
      meta.size <= spec.maxBytes &&
      (stillId === undefined ||
        (stillMeta !== null && (stillMeta.contentType ?? "").startsWith("image/") && stillMeta.size <= MAX_STILL_BYTES));
    if (!valid) {
      if (!isSticker) await discard();
      throw new ConvexError(meta !== null && meta.size > spec.maxBytes ? "IMAGE_TOO_BIG" : "INVALID_IMAGE");
    }
    const oldFile = user[spec.file];
    const oldStill = user[spec.still];
    if (oldFile) await ctx.storage.delete(oldFile).catch(() => {});
    if (oldStill) await ctx.storage.delete(oldStill).catch(() => {});
    await ctx.db.patch(user._id, { [spec.file]: storageId, [spec.still]: stillId });
  },
});

export const removeProfileImage = mutation({
  args: { slot: vSlot },
  handler: async (ctx, { slot }) => {
    const user = await requireApprovedUser(ctx);
    const spec = IMAGE_SLOTS[slot];
    const oldFile = user[spec.file];
    const oldStill = user[spec.still];
    if (oldFile) await ctx.storage.delete(oldFile).catch(() => {});
    if (oldStill) await ctx.storage.delete(oldStill).catch(() => {});
    await ctx.db.patch(user._id, { [spec.file]: undefined, [spec.still]: undefined });
  },
});

async function friendIdsOf(ctx: QueryCtx, userId: Id<"users">): Promise<Set<string>> {
  const [asLow, asHigh] = await Promise.all([
    ctx.db.query("friendships").withIndex("by_low", (q) => q.eq("userLow", userId)).collect(),
    ctx.db.query("friendships").withIndex("by_high", (q) => q.eq("userHigh", userId)).collect(),
  ]);
  return new Set(
    [...asLow, ...asHigh].filter((f) => f.status === "accepted").map((f) => (f.userLow === userId ? f.userHigh : f.userLow))
  );
}

/** The full profile card of an approved user. */
export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await getApprovedUser(ctx);
    if (me === null) return null;
    const user = await ctx.db.get(userId);
    if (user === null || user.status !== "approved") return null;

    const [mine, theirs] = await Promise.all([friendIdsOf(ctx, me._id), friendIdsOf(ctx, userId)]);
    const mutualIds = [...theirs].filter((id) => mine.has(id) && id !== me._id);
    const mutualUsers = await Promise.all(mutualIds.slice(0, 5).map((id) => ctx.db.get(id as Id<"users">)));

    const [bannerUrl, bannerStillUrl, cardBgUrl, cardBgStillUrl] = await Promise.all([
      fileUrl(ctx, user.bannerId),
      fileUrl(ctx, user.bannerStillId),
      fileUrl(ctx, user.cardBgId),
      fileUrl(ctx, user.cardBgStillId),
    ]);
    return {
      ...(await toPublicUser(ctx, user)),
      bio: user.bio ?? "",
      bannerUrl,
      bannerStillUrl,
      cardBgUrl,
      cardBgStillUrl,
      cardColor1: user.cardColor1 ?? null,
      cardColor2: user.cardColor2 ?? null,
      isMe: user._id === me._id,
      isFriend: mine.has(userId),
      mutualCount: mutualIds.length,
      mutualFriends: await Promise.all(
        mutualUsers.filter((u): u is Doc<"users"> => u !== null).map((u) => toPublicUser(ctx, u))
      ),
    };
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
