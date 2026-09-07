import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="py-10 px-3 text-center text-text-dim">
      <div className="text-md font-bold text-text mb-1">{title}</div>
      {subtitle && <div className="text-base">{subtitle}</div>}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
