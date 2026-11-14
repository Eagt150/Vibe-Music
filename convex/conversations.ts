import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  MAX_GROUP_NAME_LENGTH,
  MESSAGE_TTL_MS,
  areFriends,
  getApprovedUser,
  getMembership,
  orderedPair,
  requireApprovedUser,
  requireMembership,
  toPublicUser,
  type PublicUser,
} from "./lib";

async function membersOf(ctx: QueryCtx, conversationId: Id<"conversations">) {
  return await ctx.db
    .query("members")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
}

async function publicMembers(ctx: QueryCtx, members: Doc<"members">[]) {
  const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
  const result: (PublicUser & { role: Doc<"members">["role"] })[] = [];
  for (let i = 0; i < members.length; i++) {
    const user = users[i];
    if (user !== null) result.push({ ...(await toPublicUser(ctx, user)), role: members[i].role });
  }
  return result;
}

/** Conversations of the current user, most recent activity first, each with
 * its title, avatar(s), last message preview and unread count. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await getApprovedUser(ctx);
    if (me === null) return [];
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .collect();

    const items = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (conversation === null) return null;
        const members = await publicMembers(ctx, await membersOf(ctx, conversation._id));
        const others = members.filter((m) => m._id !== me._id);

        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id).gt("_creationTime", cutoff)
          )
          .order("desc")
          .first();

        const unread = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id).gt("_creationTime", Math.max(cutoff, membership.lastReadAt))
          )
          .take(100);

        return {
          _id: conversation._id,
          kind: conversation.kind,
          title:
            conversation.kind === "group"
              ? (conversation.name ?? "")
              : (others[0]?.displayName ?? ""),
          avatarUrl: conversation.kind === "direct" ? (others[0]?.avatarUrl ?? null) : null,
          memberCount: members.length,
          lastActivityAt: lastMessage?._creationTime ?? conversation._creationTime,
          lastMessage: lastMessage
            ? {
                body: lastMessage.body,
                kind: lastMessage.gif ? ("gif" as const) : lastMessage.stickerStorageId ? ("sticker" as const) : ("text" as const),
                mine: lastMessage.authorId === me._id,
                authorName: members.find((m) => m._id === lastMessage.authorId)?.displayName ?? "",
              }
            : null,
          unreadCount: unread.filter((m) => m.authorId !== me._id).length,
        };
      })
    );

    return items.filter((i) => i !== null).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await getApprovedUser(ctx);
    if (me === null) return null;
    const membership = await getMembership(ctx, conversationId, me._id);
    if (membership === null) return null;
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null) return null;
    const members = await publicMembers(ctx, await membersOf(ctx, conversationId));
    const other = members.find((m) => m._id !== me._id);
    return {
      _id: conversation._id,
      kind: conversation.kind,
      title: conversation.kind === "group" ? (conversation.name ?? "") : (other?.displayName ?? ""),
      avatarUrl: conversation.kind === "direct" ? (other?.avatarUrl ?? null) : null,
      members,
      myRole: membership.role,
    };
  },
});

/** Opens (creating if needed) the private chat with a friend. */
export const openDirect = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireApprovedUser(ctx);
    if (!(await areFriends(ctx, me._id, userId))) throw new ConvexError("NOT_FRIENDS");

    const directKey = orderedPair(me._id, userId).join(":");
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_directKey", (q) => q.eq("directKey", directKey))
      .unique();
    if (existing !== null) return existing._id;

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      kind: "direct",
      createdBy: me._id,
      directKey,
    });
    for (const id of [me._id, userId]) {
      await ctx.db.insert("members", { conversationId, userId: id, role: "member", lastReadAt: now });
    }
    return conversationId;
  },
});

function cleanGroupName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_GROUP_NAME_LENGTH);
  if (!trimmed) throw new ConvexError("GROUP_NAME_REQUIRED");
  return trimmed;
}

async function requireFriendsOf(ctx: MutationCtx, me: Id<"users">, userIds: Id<"users">[]) {
  for (const id of userIds) {
    if (id === me || !(await areFriends(ctx, me, id))) throw new ConvexError("NOT_FRIENDS");
  }
}

export const createGroup = mutation({
  args: { name: v.string(), memberIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const me = await requireApprovedUser(ctx);
    const name = cleanGroupName(args.name);
    const memberIds = [...new Set(args.memberIds)];
    if (memberIds.length === 0) throw new ConvexError("GROUP_NEEDS_MEMBERS");
    if (memberIds.length > 49) throw new ConvexError("GROUP_TOO_BIG");
    await requireFriendsOf(ctx, me._id, memberIds);

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", { kind: "group", name, createdBy: me._id });
    await ctx.db.insert("members", { conversationId, userId: me._id, role: "admin", lastReadAt: now });
    for (const userId of memberIds) {
      await ctx.db.insert("members", { conversationId, userId, role: "member", lastReadAt: now });
    }
    return conversationId;
  },
});

async function requireGroupAdmin(ctx: MutationCtx, conversationId: Id<"conversations">, userId: Id<"users">) {
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || conversation.kind !== "group") throw new ConvexError("NOT_A_GROUP");
  const membership = await requireMembership(ctx, conversationId, userId);
  if (membership.role !== "admin") throw new ConvexError("NOT_GROUP_ADMIN");
  return conversation;
}

export const renameGroup = mutation({
  args: { conversationId: v.id("conversations"), name: v.string() },
  handler: async (ctx, { conversationId, name }) => {
    const me = await requireApprovedUser(ctx);
    await requireGroupAdmin(ctx, conversationId, me._id);
    await ctx.db.patch(conversationId, { name: cleanGroupName(name) });
  },
});

export const addMembers = mutation({
  args: { conversationId: v.id("conversations"), userIds: v.array(v.id("users")) },
  handler: async (ctx, { conversationId, userIds }) => {
    const me = await requireApprovedUser(ctx);
    await requireGroupAdmin(ctx, conversationId, me._id);
    const unique = [...new Set(userIds)];
    await requireFriendsOf(ctx, me._id, unique);

    const current = await membersOf(ctx, conversationId);
    if (current.length + unique.length > 50) throw new ConvexError("GROUP_TOO_BIG");
    const now = Date.now();
    for (const userId of unique) {
      if (current.some((m) => m.userId === userId)) continue;
      await ctx.db.insert("members", { conversationId, userId, role: "member", lastReadAt: now });
    }
  },
});

export const removeMember = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, { conversationId, userId }) => {
    const me = await requireApprovedUser(ctx);
    if (userId === me._id) throw new ConvexError("USE_LEAVE");
    await requireGroupAdmin(ctx, conversationId, me._id);
    const membership = await getMembership(ctx, conversationId, userId);
    if (membership !== null) await ctx.db.delete(membership._id);
  },
});

/** Leaves a group. If the last admin leaves, the oldest remaining member
 * becomes admin; if nobody is left, the group and its messages are deleted. */
export const leaveGroup = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await requireApprovedUser(ctx);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || conversation.kind !== "group") throw new ConvexError("NOT_A_GROUP");
    const membership = await requireMembership(ctx, conversationId, me._id);
    await ctx.db.delete(membership._id);

    const remaining = await membersOf(ctx, conversationId);
    if (remaining.length === 0) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
        .collect();
      for (const m of messages) await ctx.db.delete(m._id);
      await ctx.db.delete(conversationId);
      return;
    }
    if (!remaining.some((m) => m.role === "admin")) {
      const oldest = remaining.reduce((a, b) => (a._creationTime < b._creationTime ? a : b));
      await ctx.db.patch(oldest._id, { role: "admin" });
    }
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const me = await requireApprovedUser(ctx);
    const membership = await getMembership(ctx, conversationId, me._id);
    if (membership !== null) await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
  },
});
