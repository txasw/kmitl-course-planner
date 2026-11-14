import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /**
   * How the state sits in its place: region fills the region it stands in for, and card
   * is a compact bordered surface laid over another surface, such as the timetable, so
   * the gridlines under it do not run through the text.
   */
  variant?: 'region' | 'card';
}

const LAYOUT = {
  region: 'h-full justify-center px-6',
  card: 'max-w-sm rounded-kcp border border-border bg-surface px-6 py-5',
} as const;

const ICON_TONE = {
  region: 'bg-surface-alt text-ink-soft',
  card: 'bg-primary-soft text-primary-strong',
} as const;

// A designed empty state: an icon, one line of title, one sentence of guidance,
// and at most one action. Regions that have no real action yet omit it rather
// than render a control that does nothing.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'region',
}: EmptyStateProps) {
  return (
    <div
      data-empty-variant={variant}
      className={`flex flex-col items-center gap-3 text-center ${LAYOUT[variant]}`}
    >
      <span
        className={`flex size-12 items-center justify-center rounded-full ${ICON_TONE[variant]}`}
      >
        <Icon size={24} strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="max-w-xs text-sm text-ink-soft">{description}</p>
      {action}
    </div>
  );
}
