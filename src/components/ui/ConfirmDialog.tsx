import { useLocale } from "@/i18n/LocaleContext";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useLocale();
  return (
    <Modal onClose={onCancel}>
      <div className="text-md font-extrabold mb-2">{title}</div>
      <div className="text-base text-text-dim mb-5">{body}</div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          className={danger ? "bg-danger text-white" : undefined}
        >
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
