import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: number;
  variant?: "solid" | "ghost";
  children: ReactNode;
}

/** Circular icon button. `active` fills it with the accent color (never a
 * grayscale filter — emoji/icon glyphs render as a solid block under
 * `filter: grayscale()` in most browsers, which is the exact bug this app's
 * design system explicitly warns against). Inactive/disabled states use
 * opacity instead. */
export function IconButton({
  active = false,
  size = 34,
  variant = "ghost",
  className,
  style,
  disabled,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{ width: size, height: size, ...style }}
      className={cn(
        "inline-flex items-center justify-center rounded-full cursor-pointer flex-shrink-0",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-accent text-accent-text border-0"
          : variant === "solid"
            ? "bg-surface-alt text-text border border-border"
            : "bg-transparent text-text border-0 opacity-70 hover:opacity-100",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
