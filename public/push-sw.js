// Loaded into the app's service worker (vite.config.ts → workbox.importScripts).
// Shows Web Push notifications and opens the chat when one is tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Vibe Music";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { conversationId: data.conversationId || null },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.conversationId;
  const url = id ? "/?chat=" + encodeURIComponent(id) : "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if (id) c.postMessage({ type: "open-chat", conversationId: id });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
