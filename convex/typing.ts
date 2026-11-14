import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getApprovedUser, getMembership, requireApprovedUser, requireMembership } from "./lib";

/** How long one "I'm typing" ping lasts. The composer pings every few
 * seconds while the user keeps typing. */
const TYPING_TTL_MS = 6000;

export const ping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await requireApprovedUser(ctx);
    await requireMembership(ctx, conversationId, me._id);
    const until = Date.now() + TYPING_TTL_MS;
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation_user", (q) => q.eq("conversationId", conversationId).eq("userId", me._id))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { until });
    else await ctx.db.insert("typing", { conversationId, userId: me._id, until });
  },
});

export const stop = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await requireApprovedUser(ctx);
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation_user", (q) => q.eq("conversationId", conversationId).eq("userId", me._id))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** Who else is typing in a chat, with each one's expiry — the client drops
 * expired entries on its own clock, since this query only re-runs when a
 * row changes. */
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getApprovedUser(ctx);
    if (me === null || (await getMembership(ctx, conversationId, me._id)) === null) return [];
    const rows = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    const now = Date.now();
    const result: { userId: string; displayName: string; until: number }[] = [];
    for (const r of rows) {
      if (r.userId === me._id || r.until < now) continue;
      const user = await ctx.db.get(r.userId);
      if (user) result.push({ userId: r.userId, displayName: user.displayName || user.username || "", until: r.until });
    }
    return result;
  },
});
