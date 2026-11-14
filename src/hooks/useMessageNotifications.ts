import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUiState } from "@/context/UiStateContext";
import { useLocale } from "@/i18n/LocaleContext";
import { playMessageSound } from "@/lib/messageSound";
import { systemNotificationsSupported, useNotificationPrefs } from "@/lib/notificationPrefs";

/** Dings (and, if enabled, shows an OS notification) when a message from
 * someone else arrives in a chat the user isn't looking at. Mounted once,
 * in AppShell, so it works from the Music section too. */
export function useMessageNotifications() {
  const conversations = useQuery(api.conversations.list);
  const { section, activeConversationId, openConversation } = useUiState();
  const { t } = useLocale();
  const prefs = useNotificationPrefs();
  // Last activity seen per conversation. The first snapshot only fills it:
  // messages that were already there when the app opened don't ding.
  const seenRef = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    if (conversations === undefined) return;
    const first = seenRef.current === null;
    const seen = seenRef.current ?? new Map<string, number>();
    seenRef.current = seen;

    for (const c of conversations) {
      const prev = seen.get(c._id);
      seen.set(c._id, c.lastActivityAt);
      if (first || !c.lastMessage || c.lastMessage.mine || c.unreadCount === 0) continue;
      if (prev !== undefined && c.lastActivityAt <= prev) continue;

      const lookingAtIt = !document.hidden && section === "messages" && activeConversationId === c._id;
      if (lookingAtIt) continue;
      // A muted chat stays quiet unless the new message mentions me.
      if (c.muted && !c.lastMessage.mentionsMe) continue;

      if (prefs.messageSound) playMessageSound();

      if (
        prefs.systemNotifications &&
        systemNotificationsSupported &&
        Notification.permission === "granted" &&
        (document.hidden || !document.hasFocus())
      ) {
        const kindKey = {
          gif: "messages.gifPreview",
          sticker: "messages.stickerPreview",
          voice: "messages.voicePreview",
          image: "messages.imagePreview",
        } as const;
        const text = c.lastMessage.kind === "text" ? c.lastMessage.body : t(kindKey[c.lastMessage.kind]);
        const n = new Notification(c.title, {
          body: c.kind === "group" ? `${c.lastMessage.authorName}: ${text}` : text,
          icon: c.avatarUrl ?? "/icon-192.png",
          // One notification per chat: a newer message replaces the older one.
          tag: c._id,
        });
        n.onclick = () => {
          window.focus();
          openConversation(c._id);
          n.close();
        };
      }
    }
  }, [conversations, section, activeConversationId, prefs, t, openConversation]);
}
