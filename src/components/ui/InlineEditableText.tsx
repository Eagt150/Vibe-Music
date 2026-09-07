import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InlineEditableTextProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  confirmOnBlur?: boolean;
}

export function InlineEditableText({
  value,
  onConfirm,
  onCancel,
  confirmOnBlur = false,
  className,
  ...rest
}: InlineEditableTextProps) {
  const [draft, setDraft] = useState(value);

  function confirm() {
    const trimmed = draft.trim();
    if (trimmed) onConfirm(trimmed);
    else onCancel();
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") confirm();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => (confirmOnBlur ? confirm() : undefined)}
      className={cn(
        "bg-input-bg border border-border rounded-sm px-2 py-1.5 text-text outline-none",
        "focus:border-accent",
        className
      )}
      {...rest}
    />
  );
}
