import { useEffect } from "react";
import { useUiState } from "@/context/UiStateContext";

/** Opens the chat a tapped push notification points to: either via
 * "?chat=<id>" when the app was closed, or a message from the service worker
 * when it was already open. */
export function useOpenChatFromPush() {
  const { openConversation } = useUiState();

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("chat");
    if (id) {
      openConversation(id);
      url.searchParams.delete("chat");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; conversationId?: string } | null;
      if (data?.type === "open-chat" && typeof data.conversationId === "string") openConversation(data.conversationId);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [openConversation]);
}
