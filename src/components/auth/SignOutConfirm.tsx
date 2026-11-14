import { useAuthActions } from "@convex-dev/auth/react";
import { useLocale } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function SignOutConfirm({ onCancel }: { onCancel: () => void }) {
  const { t } = useLocale();
  const { signOut } = useAuthActions();
  return (
    <ConfirmDialog
      title={t("auth.signOutConfirmTitle")}
      body={t("auth.signOutConfirmBody")}
      confirmLabel={t("auth.signOut")}
      danger
      onConfirm={() => void signOut()}
      onCancel={onCancel}
    />
  );
}
