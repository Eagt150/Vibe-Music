import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Endpoints for the trading bot program. Every request must carry
// "Authorization: Bearer <TRADING_BOT_TOKEN>" (set it with
// `npx convex env set TRADING_BOT_TOKEN <long random string>`). Without that
// variable the endpoints are closed.

const http = httpRouter();

function authorized(req: Request): boolean {
  const token = process.env.TRADING_BOT_TOKEN;
  if (!token || token.length < 24) return false;
  const got = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${token}`;
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await req.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

http.route({
  path: "/bot/trading/message",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const data = await readJson(req);
    const message = typeof data?.message === "string" ? data.message : null;
    if (!message) return json({ error: "message required" }, 400);
    const offerId = typeof data?.offerId === "string" ? data.offerId : null;
    const ttlMs = typeof data?.ttlMs === "number" ? data.ttlMs : 5 * 60 * 1000;
    try {
      const result = await ctx.runMutation(internal.tradingBot.post, {
        body: message,
        offer: offerId ? { offerId, ttlMs } : undefined,
      });
      return json({ ok: true, ...result });
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  }),
});

http.route({
  path: "/bot/trading/inbox",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const data = await readJson(req);
    const ack = Array.isArray(data?.ack) ? data.ack.filter((x): x is string => typeof x === "string") : [];
    const events = await ctx.runMutation(internal.tradingBot.takeInbox, { ack });
    return json({ events });
  }),
});

http.route({
  path: "/bot/trading/state",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const data = await readJson(req);
    try {
      await ctx.runMutation(internal.tradingBot.saveSnapshot, data as never);
      return json({ ok: true });
    } catch (err) {
      return json({ error: String(err) }, 400);
    }
  }),
});

export default http;
