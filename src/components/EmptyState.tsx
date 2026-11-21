import type { LucideIcon } from 'lucide-react';
import type { MouseEvent, ReactNode, Ref } from 'react';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** Ids for the title and the sentence, so a dialog can name them as its description. */
  titleId?: string;
  descriptionId?: string;
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
  titleId,
  descriptionId,
}: EmptyStateProps) {
  return (
    <div
      data-empty-state
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-ink-soft">
        <Icon size={24} strokeWidth={1.75} aria-hidden />
      </span>
      <h3 id={titleId} className="text-sm font-semibold text-ink">
        {title}
      </h3>
      <p id={descriptionId} className="max-w-xs text-sm text-ink-soft">
        {description}
      </p>
      {action}
    </div>
  );
}

/**
 * How loud the action is. Neutral is the bordered button the mockup draws for an empty
 * state's way out. Ghost is the borderless text button of a notice over the timetable, which
 * stays quiet over the lanes. Primary is the filled orange of the search error card, whose
 * retry is the one thing left to do in the catalog.
 */
export type EmptyStateActionVariant = 'neutral' | 'ghost' | 'primary';

const VARIANT_CLASS: Readonly<Record<EmptyStateActionVariant, string>> = {
  neutral: `rounded-kcp border border-border bg-surface px-3 py-1.5 text-sm text-ink hover:bg-surface-alt ${FOCUS_RING}`,
  ghost: `rounded-kcp px-2 py-1 text-sm text-primary-strong hover:bg-primary-soft ${FOCUS_RING}`,
  primary: `rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface hover:bg-primary-hover ${FOCUS_OUTLINE}`,
};

interface EmptyStateActionProps {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  variant?: EmptyStateActionVariant;
}

// The one action of an empty state at the touch target size, neutral unless the surface
// asks otherwise. It takes pointer events back where the state sits over the grid, whose
// notice lets them through to the cells.
export function EmptyStateAction({
  label,
  onClick,
  buttonRef,
  variant = 'neutral',
}: EmptyStateActionProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`pointer-events-auto ${VARIANT_CLASS[variant]} ${TARGET_SIZE}`}
    >
      {label}
    </button>
  );
}
