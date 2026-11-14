import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle, Pencil, UserPlus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUiState } from "@/context/UiStateContext";
import { useLocale } from "@/i18n/LocaleContext";
import { Button } from "@/components/ui/Button";
import { ProfileCard } from "./ProfileCard";

/** The profile card of whoever was clicked (UiState.profileUserId). */
export function ProfileCardModal() {
  const { t } = useLocale();
  const { profileUserId, openProfile, openConversation, setProfileEditorOpen } = useUiState();
  const profile = useQuery(api.users.getProfile, profileUserId ? { userId: profileUserId as Id<"users"> } : "skip");
  const openDirect = useMutation(api.conversations.openDirect);
  const sendRequest = useMutation(api.friends.sendRequest);
  const close = () => openProfile(null);
  // The user isn't visible to us (rejected, or no longer there).
  useEffect(() => {
    if (profile === null) openProfile(null);
  }, [profile, openProfile]);
  if (!profileUserId || !profile) return null;

  async function message() {
    const id = await openDirect({ userId: profileUserId as Id<"users"> });
    close();
    openConversation(id);
  }

  return (
    <div className="fixed inset-0 bg-overlay z-[85] flex items-center justify-center p-4" onClick={close}>
      <div className="w-full max-w-[340px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-lg" onClick={(e) => e.stopPropagation()}>
        <ProfileCard
          profile={profile}
          mutualLabel={profile.mutualCount > 0 ? t("profile.mutualFriends", { count: profile.mutualCount }) : undefined}
          actions={
            profile.isMe ? (
              <Button
                size="sm"
                className="flex-1"
                icon={<Pencil size={13} />}
                onClick={() => {
                  close();
                  setProfileEditorOpen(true);
                }}
              >
                {t("profile.edit")}
              </Button>
            ) : profile.isFriend ? (
              <Button size="sm" className="flex-1" icon={<MessageCircle size={13} />} onClick={() => void message()}>
                {t("friends.message")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                icon={<UserPlus size={13} />}
                onClick={() => void sendRequest({ userId: profileUserId as Id<"users"> }).then(close)}
              >
                {t("friends.add")}
              </Button>
            )
          }
        />
      </div>
    </div>
  );
}
