import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Two-column editors. */
  xl?: boolean;
}

/** Minimal centered modal — backdrop click closes it, content clicks don't. */
export function Modal({ onClose, children, wide = false, xl = false }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-overlay z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={cn(
          "bg-surface border border-border rounded-lg p-5 w-full shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
          xl ? "max-w-3xl" : wide ? "max-w-md" : "max-w-sm"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
