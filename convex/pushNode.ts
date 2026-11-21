"use node";

import webpush from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/** Sends one notification to every browser/phone the user turned push on in.
 * Subscriptions the push service says are gone (404/410) are deleted. */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    tag: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, title, body, tag, conversationId }) => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://vibe.crm-vibe.com", pub, priv);
    const subs = await ctx.runQuery(internal.push.subscriptionsFor, { userId });
    const payload = JSON.stringify({ title, body: body.slice(0, 300), tag, conversationId });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 10, urgency: "high" }
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await ctx.runMutation(internal.push.removeEndpoint, { endpoint: s.endpoint });
          } else {
            console.warn("push failed", status ?? String(err));
          }
        }
      })
    );
  },
});
