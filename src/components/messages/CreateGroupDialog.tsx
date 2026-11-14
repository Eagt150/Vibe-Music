import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocale } from "@/i18n/LocaleContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { FriendPicker } from "./FriendPicker";
import { toggleIn } from "@/lib/toggleIn";
import type { ConversationId, UserId } from "./types";

interface CreateGroupDialogProps {
  onClose: () => void;
  onCreated: (id: ConversationId) => void;
}

export function CreateGroupDialog({ onClose, onCreated }: CreateGroupDialogProps) {
  const { t } = useLocale();
  const lists = useQuery(api.friends.list);
  const createGroup = useMutation(api.conversations.createGroup);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<UserId>>(new Set());
  const [pending, setPending] = useState(false);
  const friends = lists?.friends ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || selected.size === 0) return;
    setPending(true);
    try {
      onCreated(await createGroup({ name, memberIds: [...selected] }));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="text-md font-extrabold">{t("groups.createTitle")}</div>
        <TextField id="groupName" label={t("groups.name")} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} autoFocus />
        <div>
          <div className="text-sm font-bold text-text-dim mb-1.5">{t("groups.pickMembers")}</div>
          {lists && friends.length === 0 ? (
            <div className="text-sm text-text-dim">{t("groups.noFriendsToAdd")}</div>
          ) : (
            <FriendPicker friends={friends} selected={selected} onToggle={(id) => setSelected((s) => toggleIn(s, id))} />
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending || !name.trim() || selected.size === 0}>
            {t("groups.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
