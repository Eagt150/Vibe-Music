import { AlertTriangle, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/30 text-danger rounded-md px-3.5 py-3 text-base">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 cursor-pointer opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
