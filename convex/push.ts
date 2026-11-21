import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireApprovedUser } from "./lib";

// Phone/desktop push notifications (Web Push). The browser gives us a
// subscription; convex/pushNode.ts sends to it with the VAPID keys
// (env VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).

const MAX_PER_USER = 10;

/** The public VAPID key the browser needs to subscribe; null if push isn't set up. */
export const publicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, { endpoint, p256dh, auth }) => {
    const me = await requireApprovedUser(ctx);
    if (!endpoint.startsWith("https://") || endpoint.length > 1000 || p256dh.length > 200 || auth.length > 100) {
      throw new ConvexError("BAD_SUBSCRIPTION");
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId: me._id, p256dh, auth });
      return;
    }
    const mine = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();
    // Keep the newest few: old phones/browsers drop off.
    for (const old of mine.slice(0, Math.max(0, mine.length - MAX_PER_USER + 1))) await ctx.db.delete(old._id);
    await ctx.db.insert("pushSubscriptions", { userId: me._id, endpoint, p256dh, auth });
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const me = await requireApprovedUser(ctx);
    const row = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (row && row.userId === me._id) await ctx.db.delete(row._id);
  },
});

export const subscriptionsFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    (await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
});

export const removeEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const row = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});
