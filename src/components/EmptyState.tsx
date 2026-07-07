import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

// A designed empty state: an icon, one line of title, one sentence of guidance,
// and at most one action. Regions that have no real action yet omit it rather
// than render a control that does nothing.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-ink-soft">
        <Icon size={24} strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="max-w-xs text-sm text-ink-soft">{description}</p>
      {action}
    </div>
  );
}
