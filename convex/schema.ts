import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Only the messaging side of the app lives here. Music, playlists and covers
// never leave the device (IndexedDB, see src/lib/db) — nothing in this schema
// stores audio.

export const vTrade = v.object({
  id: v.string(),
  side: v.union(v.literal("long"), v.literal("short")),
  entry: v.number(),
  stop: v.number(),
  tp: v.number(),
  qty: v.number(),
  margin: v.number(),
  leverage: v.number(),
  openedAt: v.number(),
  exit: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  result: v.optional(v.string()),
  pnl: v.optional(v.number()),
});

export default defineSchema({
  // The row id is what the auth core stores as the user of a session. The
  // username itself lives in the `authUsername` component and is copied here
  // on every sign-in (see users.onSignIn) so queries can search and display it.
  users: defineTable({
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarId: v.optional(v.id("_storage")),
    // Profile customization. Each image may be an animated GIF; for those a
    // first-frame "still" is stored too, shown until the user hovers it.
    avatarStillId: v.optional(v.id("_storage")),
    bannerId: v.optional(v.id("_storage")),
    bannerStillId: v.optional(v.id("_storage")),
    nameplateId: v.optional(v.id("_storage")),
    nameplateStillId: v.optional(v.id("_storage")),
    cardBgId: v.optional(v.id("_storage")),
    cardBgStillId: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    // "#rrggbb"; with nameColor2 the name is a gradient.
    nameColor: v.optional(v.string()),
    nameColor2: v.optional(v.string()),
    // The little pill next to the name: one emoji + up to 4 letters.
    tagEmoji: v.optional(v.string()),
    tagText: v.optional(v.string()),
    // Profile card theme (gradient), used when there is no card background.
    cardColor1: v.optional(v.string()),
    cardColor2: v.optional(v.string()),
    // Registration is closed: a new account waits as "pending" until the
    // admin approves it. Only "approved" users can use messaging.
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    role: v.union(v.literal("admin"), v.literal("user")),
    // Bots (the "trading" bot) have no login: they post through an HTTP
    // endpoint guarded by a secret token (see convex/http.ts).
    isBot: v.optional(v.boolean()),
  })
    .index("by_username", ["username"])
    .index("by_status", ["status"]),

  // One row per pair of users, stored with the lower id first so a pair has
  // exactly one row whoever sent the request.
  friendships: defineTable({
    userLow: v.id("users"),
    userHigh: v.id("users"),
    requestedBy: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted")),
  })
    .index("by_pair", ["userLow", "userHigh"])
    .index("by_low", ["userLow"])
    .index("by_high", ["userHigh"]),

  conversations: defineTable({
    kind: v.union(v.literal("direct"), v.literal("group")),
    name: v.optional(v.string()),
    createdBy: v.id("users"),
    // "<lowId>:<highId>" for direct chats, so opening a chat with the same
    // friend twice reuses the existing conversation.
    directKey: v.optional(v.string()),
  }).index("by_directKey", ["directKey"]),

  members: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    lastReadAt: v.number(),
    // Muted chats don't ding or count in the Messages badge, except mentions.
    muted: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  // Messages expire 3 days after they are sent: queries hide older ones and
  // the hourly cron (convex/crons.ts) deletes them for real.
  // A message is text (`body`), a GIF (`gif`) or a sticker (`stickerStorageId`).
  messages: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.string(),
    // Only KLIPY's own URLs: their terms forbid re-hosting the media, so the
    // message keeps the link and browsers load it straight from KLIPY.
    gif: v.optional(
      v.object({ slug: v.string(), url: v.string(), width: v.number(), height: v.number() })
    ),
    stickerStorageId: v.optional(v.id("_storage")),
    voice: v.optional(v.object({ storageId: v.id("_storage"), durationMs: v.number() })),
    image: v.optional(v.object({ storageId: v.id("_storage"), width: v.number(), height: v.number() })),
    replyToId: v.optional(v.id("messages")),
    editedAt: v.optional(v.number()),
    // Users @mentioned in the text (resolved against the chat's members).
    mentions: v.optional(v.array(v.id("users"))),
    // A trading bot alert with "Enter / Skip" buttons, answerable until
    // expiresAt. The answer is queued in botInbox for the bot to pick up.
    tradeOffer: v.optional(
      v.object({
        offerId: v.string(),
        expiresAt: v.number(),
        decision: v.optional(v.union(v.literal("enter"), v.literal("skip"))),
        decidedAt: v.optional(v.number()),
      })
    ),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_author", ["authorId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_conversation", ["conversationId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  // "is typing…": one row per user per chat, valid until `until`.
  typing: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    until: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_until", ["until"]),

  // What the admin told the trading bot (offer answers and chat commands),
  // waiting for the bot to fetch and acknowledge it.
  botInbox: defineTable({
    kind: v.union(v.literal("decision"), v.literal("command")),
    offerId: v.optional(v.string()),
    decision: v.optional(v.union(v.literal("enter"), v.literal("skip"))),
    text: v.optional(v.string()),
  }),

  // The trading bot's paper account as last reported by the bot program:
  // one row, replaced on every change. Only the admin can read it.
  tradingSnapshot: defineTable({
    balance: v.number(),
    startBalance: v.number(),
    currency: v.string(),
    open: v.array(vTrade),
    closed: v.array(vTrade),
  }),

  // A user's sticker collection. Saving a friend's sticker adds a row that
  // points at the same file, so the file is deleted only when no collection
  // uses it any more (see stickers.deleteFileIfUnused).
  stickers: defineTable({
    ownerId: v.id("users"),
    storageId: v.id("_storage"),
  })
    .index("by_owner", ["ownerId"])
    .index("by_storage", ["storageId"])
    .index("by_owner_storage", ["ownerId", "storageId"]),
});
