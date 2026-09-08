import { useState } from "react";
import { useLocale } from "@/i18n/LocaleContext";
import type { DuplicateDecision, DuplicateInfo } from "@/lib/importFiles";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface DuplicateConfirmDialogProps {
  info: DuplicateInfo | null;
  onRespond: (decision: DuplicateDecision, applyToAll: boolean) => void;
}

export function DuplicateConfirmDialog({ info, onRespond }: DuplicateConfirmDialogProps) {
  const { t } = useLocale();
  const [applyToAll, setApplyToAll] = useState(false);
  if (!info) return null;

  return (
    <Modal onClose={() => onRespond("skip", applyToAll)}>
      <div className="text-md font-extrabold mb-2">{t("importFlow.duplicateTitle")}</div>
      <div className="text-base text-text-dim mb-4">
        {t("importFlow.duplicateBody", { title: info.title, artist: info.artist })}
      </div>
      <label className="flex items-center gap-2 text-sm text-text-dim mb-4 cursor-pointer">
        <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} />
        {t("importFlow.duplicateApplyToAll")}
      </label>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => onRespond("skip", applyToAll)}>
          {t("importFlow.duplicateSkip")}
        </Button>
        <Button onClick={() => onRespond("import", applyToAll)}>{t("importFlow.duplicateImportAnyway")}</Button>
      </div>
    </Modal>
  );
}
