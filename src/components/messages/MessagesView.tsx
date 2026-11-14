import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { MessageCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useLocale } from "@/i18n/LocaleContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConversationList } from "./ConversationList";
import { ChatView } from "./ChatView";
import { FriendsPanel } from "./FriendsPanel";
import { CreateGroupDialog } from "./CreateGroupDialog";
import type { ConversationId, MessagesPane } from "./types";

/** Discord-style messaging: chat list on the left, the open chat (or the
 * friends panel) on the right. On mobile only one of the two is shown. */
export function MessagesView() {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const me = useQuery(api.users.me);
  const conversations = useQuery(api.conversations.list);
  const friends = useQuery(api.friends.list);
  const [pane, setPane] = useState<MessagesPane>({ type: "empty" });
  const [creatingGroup, setCreatingGroup] = useState(false);

  const openChat = useCallback((conversationId: ConversationId) => setPane({ type: "chat", conversationId }), []);
  const closePane = useCallback(() => setPane({ type: "empty" }), []);

  if (!me) return null;

  const selectedId = pane.type === "chat" ? pane.conversationId : null;
  const showList = !isMobile || pane.type === "empty";
  const showPane = !isMobile || pane.type !== "empty";

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {showList && (
        <div className={isMobile ? "flex-1 min-w-0" : "w-[300px] flex-shrink-0 bg-surface border-r border-border"}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            friendsActive={pane.type === "friends"}
            incomingRequests={friends?.incoming.length ?? 0}
            onSelect={openChat}
            onOpenFriends={() => setPane({ type: "friends" })}
            onNewGroup={() => setCreatingGroup(true)}
          />
        </div>
      )}

      {showPane && (
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {pane.type === "chat" && (
            <ChatView
              key={pane.conversationId}
              conversationId={pane.conversationId}
              myId={me._id}
              onBack={isMobile ? closePane : undefined}
              onLeft={closePane}
            />
          )}
          {pane.type === "friends" && <FriendsPanel onBack={isMobile ? closePane : undefined} onOpenChat={openChat} />}
          {pane.type === "empty" && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="flex flex-col items-center text-text-faint">
                <MessageCircle size={32} />
                <EmptyState title={t("messages.pickConversation")} subtitle={t("messages.pickConversationSubtitle")} />
              </div>
            </div>
          )}
        </div>
      )}

      {creatingGroup && (
        <CreateGroupDialog
          onClose={() => setCreatingGroup(false)}
          onCreated={(id) => {
            setCreatingGroup(false);
            openChat(id);
          }}
        />
      )}
    </div>
  );
}
