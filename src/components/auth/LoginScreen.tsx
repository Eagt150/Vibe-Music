import { useState, type FormEvent } from "react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "../../../convex/_generated/api";
import { useLocale, type TranslationKey } from "@/i18n/LocaleContext";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";

// Must match USERNAME_PATTERN in convex/lib.ts and the password component's
// default minimum length.
const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;
const MIN_PASSWORD_LENGTH = 10;

type Mode = "signIn" | "signUp";

function errorKey(code: string): TranslationKey {
  switch (code) {
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      return "auth.errorWrongCredentials";
    case "RATE_LIMITED":
      return "auth.errorRateLimited";
    case "USERNAME_TAKEN":
      return "auth.errorUsernameTaken";
    case "PASSWORD_TOO_SHORT":
      return "auth.errorPasswordShort";
    case "PASSWORD_TOO_COMMON":
      return "auth.errorPasswordCommon";
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
    case "USERNAME_HAS_INVALID_CHARACTERS":
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
      return "auth.errorInvalidUsername";
    default:
      return "auth.errorGeneric";
  }
}

export function LoginScreen() {
  const { t } = useLocale();
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const [mode, setMode] = useState<Mode>("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = signingIn || signingUp;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirm("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = username.trim().toLowerCase().replace(/^@/, "");

    if (mode === "signUp") {
      if (!USERNAME_PATTERN.test(name)) return setError(t("auth.errorInvalidUsername"));
      if (password.length < MIN_PASSWORD_LENGTH) {
        return setError(t("auth.errorPasswordShort", { min: MIN_PASSWORD_LENGTH }));
      }
      if (password !== confirm) return setError(t("auth.errorPasswordsDiffer"));
    }

    const result = mode === "signIn" ? await signIn({ username: name, password }) : await signUp({ username: name, password });
    if (result.status === "error") {
      setError(t(errorKey(result.userError.error), { min: MIN_PASSWORD_LENGTH }));
    }
  }

  return (
    <div className="min-h-screen w-full bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-2">
          <span className="w-3 h-3 rounded-full bg-accent" />
          <span className="font-extrabold text-2xl tracking-tight">Vibe Music</span>
        </div>
        <p className="text-center text-base text-text-dim mb-6">{t("auth.tagline")}</p>

        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="grid grid-cols-2 gap-1 bg-surface-alt rounded-pill p-1 mb-5" role="tablist">
            {(["signIn", "signUp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "rounded-pill py-1.5 text-sm font-bold cursor-pointer",
                  mode === m ? "bg-accent text-accent-text" : "text-text-dim hover:text-text"
                )}
              >
                {m === "signIn" ? t("auth.signIn") : t("auth.requestAccess")}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <TextField
              id="username"
              label={t("auth.username")}
              hint={mode === "signUp" ? t("auth.usernameHint") : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <TextField
              id="password"
              type="password"
              label={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              required
            />
            {mode === "signUp" && (
              <TextField
                id="confirm"
                type="password"
                label={t("auth.confirmPassword")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            )}

            {error && (
              <div role="alert" className="text-sm text-danger">
                {error}
              </div>
            )}
            {mode === "signUp" && <p className="text-sm text-text-faint">{t("auth.requestNote")}</p>}

            <Button type="submit" disabled={pending} className="mt-1">
              {mode === "signIn" ? t("auth.submitSignIn") : t("auth.submitRequest")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
