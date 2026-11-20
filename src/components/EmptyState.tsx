import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode, Ref } from 'react';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

// A designed empty state per brief 8.2: an icon in a neutral disc, one line of title, one
// sentence of guidance, and one action, so the catalog, the summary, the timetable, and
// the dialogs all say "nothing here" the same way. The action is an EmptyStateAction, the
// one way out of the state. Only a surface that is a picture rather than a control, the
// preview poster, omits it, since a shared image carries no control.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      data-empty-state
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-ink-soft">
        <Icon size={24} strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="max-w-xs text-sm text-ink-soft">{description}</p>
      {action}
    </div>
  );
}

interface EmptyStateActionProps {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

// The one action of an empty state, a filled primary button at the touch target size. It
// takes pointer events back where the state sits over the grid, whose notice lets them
// through to the cells.
export function EmptyStateAction({
  label,
  onClick,
  buttonRef,
}: EmptyStateActionProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`pointer-events-auto rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${TARGET_SIZE} ${FOCUS_OUTLINE}`}
    >
      {label}
    </button>
  );
}
