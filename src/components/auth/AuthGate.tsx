import { useEffect, useState, type ReactNode } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useLocale } from "@/i18n/LocaleContext";
import { Button } from "@/components/ui/Button";
import { LoginScreen } from "./LoginScreen";
import { SignOutConfirm } from "./SignOutConfirm";

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  const { t } = useLocale();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  return (
    <div className="min-h-screen w-full bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg p-6 text-center">
        <div className="text-lg font-extrabold mb-2">{title}</div>
        <p className="text-base text-text-dim mb-5">{body}</p>
        <Button variant="secondary" onClick={() => setConfirmingSignOut(true)}>
          {t("auth.signOut")}
        </Button>
      </div>
      {confirmingSignOut && <SignOutConfirm onCancel={() => setConfirmingSignOut(false)} />}
    </div>
  );
}

function Splash() {
  return (
    <div className="min-h-screen w-full bg-bg flex items-center justify-center">
      <span className="w-3 h-3 rounded-full bg-accent animate-pulse" />
    </div>
  );
}

/** Everything behind it needs an approved account. Signed-out visitors get
 * the login screen; a new account waits on the "request sent" screen, which
 * switches to the app by itself as soon as the admin approves it (the `me`
 * query is live). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const syncProfile = useMutation(api.users.syncProfile);

  // Sign-up stores the username after the account row exists; copy it over
  // once there is a session (a no-op on later visits).
  useEffect(() => {
    if (isAuthenticated) void syncProfile();
  }, [isAuthenticated, syncProfile]);

  if (isLoading) return <Splash />;
  if (!isAuthenticated) return <LoginScreen />;
  if (me === undefined || (me !== null && !me.username)) return <Splash />;
  if (me === null) return <LoginScreen />;
  if (me.status === "pending") {
    return <FullScreenMessage title={t("auth.pendingTitle")} body={t("auth.pendingBody", { username: me.username })} />;
  }
  if (me.status === "rejected") {
    return <FullScreenMessage title={t("auth.rejectedTitle")} body={t("auth.rejectedBody", { username: me.username })} />;
  }
  return <>{children}</>;
}
