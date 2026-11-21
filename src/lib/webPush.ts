// Web Push on this browser/phone: subscribe with the server's VAPID key and
// hand the subscription to Convex (convex/push.ts).

export const pushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPhone/iPad only allow push from the app added to the home screen. */
export const isIosBrowserTab =
  typeof window !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.matchMedia("(display-mode: standalone)").matches;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function b64url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function createSubscription(publicKey: string) {
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  return { sub, endpoint: sub.endpoint, p256dh: b64url(sub.getKey("p256dh")), auth: b64url(sub.getKey("auth")) };
}
