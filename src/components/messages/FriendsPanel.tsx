import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, MessageCircle, UserMinus, UserPlus, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useLocale } from "@/i18n/LocaleContext";
import { UserRow } from "@/components/user/UserRow";
import { useUiState } from "@/context/UiStateContext";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SearchBar } from "@/components/ui/SearchBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ConversationId, FriendRow } from "./types";

function UserLine({ user, children }: { user: FriendRow["user"]; children?: ReactNode }) {
  const { openProfile } = useUiState();
  return (
    <UserRow user={user} subtitle={`@${user.username}`} avatarSize={38} onClick={() => openProfile(user._id)}>
      {children}
    </UserRow>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-sm font-bold tracking-wide text-text-faint uppercase px-2.5 pt-5 pb-1.5">{children}</div>;
}

interface FriendsPanelProps {
  onBack?: () => void;
  onOpenChat: (id: ConversationId) => void;
}

export function FriendsPanel({ onBack, onOpenChat }: FriendsPanelProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<FriendRow | null>(null);
  const lists = useQuery(api.friends.list);
  const trimmed = query.trim().replace(/^@/, "");
  const results = useQuery(api.friends.search, trimmed.length >= 2 ? { query: trimmed } : "skip");
  const sendRequest = useMutation(api.friends.sendRequest);
  const respond = useMutation(api.friends.respond);
  const remove = useMutation(api.friends.remove);
  const openDirect = useMutation(api.conversations.openDirect);

  async function message(userId: FriendRow["user"]["_id"]) {
    onOpenChat(await openDirect({ userId }));
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-3.5 md:px-5 py-3 border-b border-border flex-shrink-0">
        {onBack && (
          <IconButton onClick={onBack} aria-label={t("common.back")}>
            <ArrowLeft size={16} />
          </IconButton>
        )}
        <span className="font-extrabold text-md">{t("friends.title")}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 md:px-3 py-3">
        <div className="px-2.5">
          <SearchBar value={query} onChange={setQuery} placeholder={t("friends.searchPlaceholder")} className="w-full" />
        </div>

        {trimmed.length >= 2 && (
          <div className="mt-2">
            {results?.length === 0 && <div className="px-2.5 py-3 text-sm text-text-dim">{t("friends.noResults")}</div>}
            {results?.map(({ user, relation }) => (
              <UserLine key={user._id} user={user}>
                {relation === "none" && (
                  <Button size="sm" icon={<UserPlus size={13} />} onClick={() => void sendRequest({ userId: user._id })}>
                    {t("friends.add")}
                  </Button>
                )}
                {relation === "outgoing" && <span className="text-sm text-text-faint">{t("friends.requested")}</span>}
                {relation === "incoming" && (
                  <Button size="sm" icon={<Check size={13} />} onClick={() => void sendRequest({ userId: user._id })}>
                    {t("friends.accept")}
                  </Button>
                )}
                {relation === "friend" && (
                  <Button size="sm" variant="secondary" icon={<MessageCircle size={13} />} onClick={() => void message(user._id)}>
                    {t("friends.message")}
                  </Button>
                )}
              </UserLine>
            ))}
          </div>
        )}

        {lists && lists.incoming.length > 0 && (
          <>
            <SectionTitle>{t("friends.incoming")}</SectionTitle>
            {lists.incoming.map((r) => (
              <UserLine key={r.friendshipId} user={r.user}>
                <Button size="sm" icon={<Check size={13} />} onClick={() => void respond({ friendshipId: r.friendshipId, accept: true })}>
                  {t("friends.accept")}
                </Button>
                <IconButton
                  variant="solid"
                  onClick={() => void respond({ friendshipId: r.friendshipId, accept: false })}
                  aria-label={t("friends.decline")}
                  title={t("friends.decline")}
                >
                  <X size={14} />
                </IconButton>
              </UserLine>
            ))}
          </>
        )}

        {lists && lists.outgoing.length > 0 && (
          <>
            <SectionTitle>{t("friends.outgoing")}</SectionTitle>
            {lists.outgoing.map((r) => (
              <UserLine key={r.friendshipId} user={r.user}>
                <Button size="sm" variant="ghost" onClick={() => void remove({ friendshipId: r.friendshipId })}>
                  {t("friends.cancelRequest")}
                </Button>
              </UserLine>
            ))}
          </>
        )}

        <SectionTitle>{t("friends.yourFriends")}</SectionTitle>
        {lists?.friends.length === 0 && <div className="px-2.5 py-2 text-sm text-text-dim">{t("friends.noFriends")}</div>}
        {lists?.friends.map((r) => (
          <UserLine key={r.friendshipId} user={r.user}>
            <Button size="sm" variant="secondary" icon={<MessageCircle size={13} />} onClick={() => void message(r.user._id)}>
              {t("friends.message")}
            </Button>
            <IconButton onClick={() => setRemoving(r)} aria-label={t("friends.remove")} title={t("friends.remove")}>
              <UserMinus size={14} />
            </IconButton>
          </UserLine>
        ))}
      </div>

      {removing && (
        <ConfirmDialog
          title={t("friends.removeConfirmTitle", { name: removing.user.displayName })}
          body={t("friends.removeConfirmBody")}
          confirmLabel={t("friends.remove")}
          danger
          onConfirm={() => {
            void remove({ friendshipId: removing.friendshipId });
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
