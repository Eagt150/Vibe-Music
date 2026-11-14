import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, className, id, ...rest },
  ref
) {
  const input = (
    <input
      ref={ref}
      id={id}
      className={cn(
        "w-full bg-input-bg border border-border rounded-md px-3 py-2.5 text-base text-text outline-none",
        "focus:border-accent placeholder:text-text-faint",
        className
      )}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-text-dim">{label}</span>
      {input}
      {hint && <span className="text-xs text-text-faint">{hint}</span>}
    </label>
  );
});
