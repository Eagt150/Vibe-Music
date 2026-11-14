import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type ConversationId = Id<"conversations">;
export type UserId = Id<"users">;
export type ConversationSummary = FunctionReturnType<typeof api.conversations.list>[number];
export type ConversationDetails = NonNullable<FunctionReturnType<typeof api.conversations.get>>;
export type FriendRow = FunctionReturnType<typeof api.friends.list>["friends"][number];

/** What the right-hand pane of Messages shows. */
export type MessagesPane = { type: "empty" } | { type: "friends" } | { type: "chat"; conversationId: ConversationId };
