import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { vTrade } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import { MAX_MESSAGE_LENGTH, TRADING_BOT_USERNAME, getApprovedUser, orderedPair, requireApprovedUser, requireMembership } from "./lib";

// The "trading" bot: a user with no login that only talks to the admin. The
// program that watches the market (it runs on the admin's own computer) posts
// through convex/http.ts and reads the admin's answers from `botInbox`.
// It only ever does paper trading (simulated); nothing here touches real money.

const BOT_BIO =
  "Avisa setups de BTC según el curso y opera en una cuenta de práctica (sin dinero real) solo si tú pulsas Entrar.";
const MAX_OFFER_TTL_MS = 30 * 60 * 1000;
const INBOX_PAGE = 50;

type Ctx = QueryCtx | MutationCtx;

async function findBot(ctx: Ctx): Promise<Doc<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", TRADING_BOT_USERNAME))
    .first();
  return user?.isBot ? user : null;
}

async function findAdmin(ctx: Ctx): Promise<Doc<"users"> | null> {
  const name = process.env.ADMIN_USERNAME;
  if (!name) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", name))
    .first();
  return user?.role === "admin" && user.status === "approved" ? user : null;
}

/** The bot user and its private chat with the admin, created on first use. */
async function ensureBotChat(ctx: MutationCtx) {
  const admin = await findAdmin(ctx);
  if (admin === null) throw new ConvexError("NO_ADMIN");
  let bot = await findBot(ctx);
  if (bot === null) {
    const id = await ctx.db.insert("users", {
      username: TRADING_BOT_USERNAME,
      displayName: "Trading",
      status: "approved",
      role: "user",
      isBot: true,
      tagEmoji: "📈",
      tagText: "BOT",
      bio: BOT_BIO,
      nameColor: "#22c55e",
    });
    bot = (await ctx.db.get(id))!;
  } else if (bot.bio !== BOT_BIO) {
    await ctx.db.patch(bot._id, { bio: BOT_BIO });
  }
  const directKey = orderedPair(bot._id, admin._id).join(":");
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_directKey", (q) => q.eq("directKey", directKey))
    .unique();
  if (existing !== null) return { bot, admin, conversationId: existing._id };
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", { kind: "direct", createdBy: bot._id, directKey });
  for (const userId of [bot._id, admin._id]) {
    await ctx.db.insert("members", { conversationId, userId, role: "member", lastReadAt: now });
  }
  return { bot, admin, conversationId };
}

/** Called by the HTTP endpoint: posts a message (optionally with Enter/Skip
 * buttons) from the bot to the admin. */
export const post = internalMutation({
  args: {
    body: v.string(),
    offer: v.optional(v.object({ offerId: v.string(), ttlMs: v.number() })),
  },
  handler: async (ctx, { body, offer }) => {
    const text = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) throw new ConvexError("EMPTY_MESSAGE");
    const { bot, conversationId } = await ensureBotChat(ctx);
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      authorId: bot._id,
      body: text,
      ...(offer
        ? {
            tradeOffer: {
              offerId: offer.offerId.slice(0, 64),
              expiresAt: Date.now() + Math.min(Math.max(offer.ttlMs, 10_000), MAX_OFFER_TTL_MS),
            },
          }
        : {}),
    });
    return { messageId };
  },
});

/** The admin pressing "Enter" or "Skip" on an alert, before it expires. */
export const decideOffer = mutation({
  args: { messageId: v.id("messages"), decision: v.union(v.literal("enter"), v.literal("skip")) },
  handler: async (ctx, { messageId, decision }) => {
    const me = await requireApprovedUser(ctx);
    const message = await ctx.db.get(messageId);
    if (message === null || !message.tradeOffer) throw new ConvexError("NOT_AN_OFFER");
    await requireMembership(ctx, message.conversationId, me._id);
    const author = await ctx.db.get(message.authorId);
    if (!author?.isBot || me.role !== "admin") throw new ConvexError("NOT_ALLOWED");
    if (message.tradeOffer.decision) throw new ConvexError("ALREADY_DECIDED");
    if (Date.now() > message.tradeOffer.expiresAt) throw new ConvexError("OFFER_EXPIRED");
    await ctx.db.patch(messageId, { tradeOffer: { ...message.tradeOffer, decision, decidedAt: Date.now() } });
    await ctx.db.insert("botInbox", { kind: "decision", offerId: message.tradeOffer.offerId, decision });
  },
});

/** A text the admin wrote in the bot chat becomes a command for the bot
 * ("saldo", "abiertas"…). Called from messages.send. */
export async function forwardToBot(ctx: MutationCtx, conversationId: Id<"conversations">, author: Doc<"users">, body: string) {
  if (author.role !== "admin") return;
  const members = await ctx.db
    .query("members")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .take(3);
  if (members.length !== 2) return;
  const other = members.find((m) => m.userId !== author._id);
  const otherUser = other ? await ctx.db.get(other.userId) : null;
  if (!otherUser?.isBot) return;
  await ctx.db.insert("botInbox", { kind: "command", text: body.slice(0, 200) });
}

/** Called by the HTTP endpoint: drops what the bot acknowledged and returns
 * what is still waiting, oldest first. */
export const takeInbox = internalMutation({
  args: { ack: v.array(v.string()) },
  handler: async (ctx, { ack }) => {
    for (const raw of ack.slice(0, 100)) {
      const id = ctx.db.normalizeId("botInbox", raw);
      if (id && (await ctx.db.get(id))) await ctx.db.delete(id);
    }
    const rows = await ctx.db.query("botInbox").order("asc").take(INBOX_PAGE);
    return rows.map((r) => ({ id: r._id, kind: r.kind, offerId: r.offerId, decision: r.decision, text: r.text }));
  },
});

/** Called by the HTTP endpoint: replaces the paper account snapshot. */
export const saveSnapshot = internalMutation({
  args: {
    balance: v.number(),
    startBalance: v.number(),
    currency: v.string(),
    open: v.array(vTrade),
    closed: v.array(vTrade),
  },
  handler: async (ctx, args) => {
    const snapshot = { ...args, open: args.open.slice(0, 10), closed: args.closed.slice(-100) };
    const existing = await ctx.db.query("tradingSnapshot").first();
    if (existing) await ctx.db.replace(existing._id, snapshot);
    else await ctx.db.insert("tradingSnapshot", snapshot);
  },
});

/** The paper account for the chart. Admin only, like the bot itself. */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const me = await getApprovedUser(ctx);
    if (me === null || me.role !== "admin") return null;
    const row = await ctx.db.query("tradingSnapshot").first();
    if (row === null) return null;
    return { balance: row.balance, startBalance: row.startBalance, currency: row.currency, open: row.open, closed: row.closed };
  },
});
