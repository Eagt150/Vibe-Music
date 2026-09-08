import type { ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
}

/** Minimal centered modal — backdrop click closes it, content clicks don't. */
export function Modal({ onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-overlay z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg p-5 max-w-sm w-full shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
