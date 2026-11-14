import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getApprovedUser, getFriendship, orderedPair, requireApprovedUser, toPublicUser } from "./lib";

async function friendshipsOf(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"friendships">[]> {
  const [asLow, asHigh] = await Promise.all([
    ctx.db.query("friendships").withIndex("by_low", (q) => q.eq("userLow", userId)).collect(),
    ctx.db.query("friendships").withIndex("by_high", (q) => q.eq("userHigh", userId)).collect(),
  ]);
  return [...asLow, ...asHigh];
}

/** Friends plus pending requests both ways, for the friends panel. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await getApprovedUser(ctx);
    if (me === null) return { friends: [], incoming: [], outgoing: [] };
    const rows = await friendshipsOf(ctx, me._id);

    const resolved = await Promise.all(
      rows.map(async (f) => {
        const otherId = f.userLow === me._id ? f.userHigh : f.userLow;
        const other = await ctx.db.get(otherId);
        // A friend whose account was later rejected disappears from the list.
        if (other === null || other.status !== "approved") return null;
        return { friendshipId: f._id, status: f.status, incoming: f.requestedBy !== me._id, user: await toPublicUser(ctx, other) };
      })
    );
    const valid = resolved.filter((r) => r !== null);
    const byName = (a: (typeof valid)[number], b: (typeof valid)[number]) =>
      a.user.displayName.localeCompare(b.user.displayName);

    return {
      friends: valid.filter((r) => r.status === "accepted").sort(byName),
      incoming: valid.filter((r) => r.status === "pending" && r.incoming).sort(byName),
      outgoing: valid.filter((r) => r.status === "pending" && !r.incoming).sort(byName),
    };
  },
});

/** Approved users whose username starts with `query`, for "Add friend". */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const me = await getApprovedUser(ctx);
    if (me === null) return [];
    const prefix = args.query.trim().toLowerCase().replace(/^@/, "");
    if (prefix.length < 2) return [];

    const candidates = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.gte("username", prefix).lt("username", prefix + "￿"))
      .take(20);

    const results = await Promise.all(
      candidates
        .filter((u) => u._id !== me._id && u.status === "approved")
        .slice(0, 10)
        .map(async (u) => {
          const friendship = await getFriendship(ctx, me._id, u._id);
          const relation =
            friendship === null
              ? ("none" as const)
              : friendship.status === "accepted"
                ? ("friend" as const)
                : friendship.requestedBy === me._id
                  ? ("outgoing" as const)
                  : ("incoming" as const);
          return { user: await toPublicUser(ctx, u), relation };
        })
    );
    return results;
  },
});

export const sendRequest = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireApprovedUser(ctx);
    if (userId === me._id) throw new ConvexError("CANNOT_ADD_SELF");
    const other = await ctx.db.get(userId);
    if (other === null || other.status !== "approved") throw new ConvexError("USER_NOT_FOUND");

    const existing = await getFriendship(ctx, me._id, userId);
    if (existing !== null) {
      // Both sent a request to each other: the second one accepts the first.
      if (existing.status === "pending" && existing.requestedBy !== me._id) {
        await ctx.db.patch(existing._id, { status: "accepted" });
      }
      return;
    }
    const [userLow, userHigh] = orderedPair(me._id, userId);
    await ctx.db.insert("friendships", { userLow, userHigh, requestedBy: me._id, status: "pending" });
  },
});

export const respond = mutation({
  args: { friendshipId: v.id("friendships"), accept: v.boolean() },
  handler: async (ctx, { friendshipId, accept }) => {
    const me = await requireApprovedUser(ctx);
    const f = await ctx.db.get(friendshipId);
    if (f === null || f.status !== "pending") throw new ConvexError("NOT_PENDING");
    if (f.requestedBy === me._id || (f.userLow !== me._id && f.userHigh !== me._id)) {
      throw new ConvexError("NOT_YOUR_REQUEST");
    }
    if (accept) await ctx.db.patch(f._id, { status: "accepted" });
    else await ctx.db.delete(f._id);
  },
});

/** Removes a friend, or cancels a request sent by me. */
export const remove = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, { friendshipId }) => {
    const me = await requireApprovedUser(ctx);
    const f = await ctx.db.get(friendshipId);
    if (f === null) return;
    if (f.userLow !== me._id && f.userHigh !== me._id) throw new ConvexError("NOT_YOUR_FRIENDSHIP");
    await ctx.db.delete(f._id);
  },
});
