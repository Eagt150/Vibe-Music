import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LogOut } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useLocale } from "@/i18n/LocaleContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { UserRow } from "@/components/user/UserRow";
import { useUiState } from "@/context/UiStateContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FriendPicker } from "./FriendPicker";
import { toggleIn } from "@/lib/toggleIn";
import type { ConversationDetails, UserId } from "./types";

interface GroupSettingsDialogProps {
  conversation: ConversationDetails;
  myId: string;
  onClose: () => void;
  onLeft: () => void;
}

export function GroupSettingsDialog({ conversation, myId, onClose, onLeft }: GroupSettingsDialogProps) {
  const { t } = useLocale();
  const isAdmin = conversation.myRole === "admin";
  const { openProfile } = useUiState();
  const lists = useQuery(api.friends.list, isAdmin ? {} : "skip");
  const rename = useMutation(api.conversations.renameGroup);
  const addMembers = useMutation(api.conversations.addMembers);
  const removeMember = useMutation(api.conversations.removeMember);
  const leave = useMutation(api.conversations.leaveGroup);
  const [name, setName] = useState(conversation.title);
  const [adding, setAdding] = useState<Set<UserId>>(new Set());
  const [confirmLeave, setConfirmLeave] = useState(false);

  const memberIds = new Set(conversation.members.map((m) => m._id as string));
  const addable = (lists?.friends ?? []).filter((f) => !memberIds.has(f.user._id));

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="text-md font-extrabold">{t("messages.groupSettings")}</div>

        {isAdmin && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <TextField id="renameGroup" label={t("groups.name")} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button
              variant="secondary"
              disabled={!name.trim() || name.trim() === conversation.title}
              onClick={() => void rename({ conversationId: conversation._id, name })}
            >
              {t("groups.save")}
            </Button>
          </div>
        )}

        <div>
          <div className="text-sm font-bold text-text-dim mb-1.5">{t("groups.membersTitle")}</div>
          <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto -mx-1">
            {conversation.members.map((m) => (
              <UserRow
                key={m._id}
                user={m}
                avatarSize={32}
                subtitle={m.role === "admin" ? `@${m.username} · ${t("groups.admin")}` : `@${m.username}`}
                onClick={() => openProfile(m._id)}
              >
                {isAdmin && m._id !== myId && (
                  <Button size="sm" variant="ghost" onClick={() => void removeMember({ conversationId: conversation._id, userId: m._id })}>
                    {t("groups.removeMember")}
                  </Button>
                )}
              </UserRow>
            ))}
          </div>
        </div>

        {isAdmin && addable.length > 0 && (
          <div>
            <div className="text-sm font-bold text-text-dim mb-1.5">{t("groups.addMembers")}</div>
            <FriendPicker friends={addable} selected={adding} onToggle={(id) => setAdding((s) => toggleIn(s, id))} />
            <Button
              size="sm"
              className="mt-2"
              disabled={adding.size === 0}
              onClick={() => {
                void addMembers({ conversationId: conversation._id, userIds: [...adding] });
                setAdding(new Set());
              }}
            >
              {t("groups.addMembers")}
            </Button>
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" className="text-danger" icon={<LogOut size={14} />} onClick={() => setConfirmLeave(true)}>
            {t("groups.leave")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title={t("groups.leaveConfirmTitle", { name: conversation.title })}
          body={t("groups.leaveConfirmBody")}
          confirmLabel={t("groups.leave")}
          danger
          onConfirm={() => {
            void leave({ conversationId: conversation._id }).then(onLeft);
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </Modal>
  );
}
