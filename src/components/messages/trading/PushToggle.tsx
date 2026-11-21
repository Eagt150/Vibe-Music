import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Smartphone } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { IconButton } from "@/components/ui/IconButton";
import { createSubscription, currentSubscription, isIosBrowserTab, pushSupported } from "@/lib/webPush";

/** "Notify this phone" switch in the trading bot chat. */
export function PushToggle() {
  const publicKey = useQuery(api.push.publicKey);
  const subscribe = useMutation(api.push.subscribe);
  const unsubscribe = useMutation(api.push.unsubscribe);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void currentSubscription().then((s) => {
      setOn(s !== null && Notification.permission === "granted");
      // Keep the server copy fresh (it may have been dropped as expired).
      if (s && Notification.permission === "granted") {
        const k = s.toJSON().keys;
        if (k?.p256dh && k.auth) void subscribe({ endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth });
      }
    });
  }, [subscribe]);

  if (publicKey === undefined || publicKey === null) return null;

  async function toggle() {
    if (busy) return;
    if (isIosBrowserTab) {
      window.alert(
        "En iPhone las notificaciones solo funcionan desde la app instalada:\n" +
          "1. Toca Compartir (el cuadrado con flecha) en Safari.\n" +
          "2. Elige «Agregar a pantalla de inicio».\n" +
          "3. Abre Vibe Music desde ese ícono, entra a este chat y toca otra vez el teléfono."
      );
      return;
    }
    if (!pushSupported) {
      window.alert("Este navegador no permite notificaciones push. Prueba con Chrome.");
      return;
    }
    setBusy(true);
    try {
      if (on) {
        const s = await currentSubscription();
        if (s) {
          await unsubscribe({ endpoint: s.endpoint });
          await s.unsubscribe();
        }
        setOn(false);
      } else {
        const { endpoint, p256dh, auth } = await createSubscription(publicKey!);
        await subscribe({ endpoint, p256dh, auth });
        setOn(true);
        window.alert("Listo ✅ Este dispositivo recibirá los avisos del bot aunque la app esté cerrada.");
      }
    } catch (err) {
      window.alert(
        err instanceof Error && err.message === "denied"
          ? "Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador para este sitio y vuelve a intentar."
          : "No se pudo activar. Inténtalo de nuevo."
      );
    } finally {
      setBusy(false);
    }
  }

  const label = on ? "Avisos en este teléfono: activados (toca para quitar)" : "Recibir avisos en este teléfono";
  return (
    <IconButton variant="solid" onClick={() => void toggle()} aria-label={label} title={label} aria-pressed={on}>
      <span className="relative inline-flex">
        <Smartphone size={15} className={on ? "text-green-500" : undefined} />
        {on && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-500" />}
      </span>
    </IconButton>
  );
}
