import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Only the messaging side of the app lives here. Music, playlists and covers
// never leave the device (IndexedDB, see src/lib/db) — nothing in this schema
// stores audio.

export default defineSchema({
  // The row id is what the auth core stores as the user of a session. The
  // username itself lives in the `authUsername` component and is copied here
  // on every sign-in (see users.onSignIn) so queries can search and display it.
  users: defineTable({
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarId: v.optional(v.id("_storage")),
    // Registration is closed: a new account waits as "pending" until the
    // admin approves it. Only "approved" users can use messaging.
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    role: v.union(v.literal("admin"), v.literal("user")),
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
  })
    .index("by_conversation", ["conversationId"])
    .index("by_author", ["authorId"]),

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
