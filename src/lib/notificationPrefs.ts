import { useSyncExternalStore } from "react";
import { getSettings, updateSettings } from "@/lib/db/settings";

export interface NotificationPrefs {
  messageSound: boolean;
  systemNotifications: boolean;
}

// Small shared store over the IndexedDB settings row, so the profile toggles
// and the notifier hook stay in sync without a context provider.
let prefs: NotificationPrefs = { messageSound: true, systemNotifications: false };
const listeners = new Set<() => void>();
let loaded = false;

function emit() {
  for (const l of listeners) l();
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  void getSettings().then((s) => {
    prefs = { messageSound: s.messageSound, systemNotifications: s.systemNotifications };
    emit();
  });
}

export function setNotificationPrefs(patch: Partial<NotificationPrefs>) {
  prefs = { ...prefs, ...patch };
  emit();
  void updateSettings(patch);
}

export function useNotificationPrefs(): NotificationPrefs {
  ensureLoaded();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs
  );
}

export const systemNotificationsSupported = typeof window !== "undefined" && "Notification" in window;
