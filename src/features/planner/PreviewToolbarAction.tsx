// One action button of the preview toolbar. From 640 px up it is a labelled button. Below
// 640 px the toolbar runs along the panel foot under the thumb, where five labelled buttons
// would not fit one row, so the action is an icon button at the 44 px touch size at every
// pointer, named by its aria-label and titled with the same text for a pointer hover. A busy
// action is marked aria-disabled rather than disabled, so the focused button keeps focus
// through a capture.

import type { ReactNode } from 'react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE, TARGET_TOUCH } from '@/lib/ui/target';

const SHARED =
  'inline-flex items-center rounded-kcp border border-border text-ink hover:bg-surface-alt aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent';

/** The labelled toolbar button, from 640 px up. */
export const TOOLBAR_BUTTON = `${SHARED} gap-1.5 px-2.5 py-1.5 text-sm ${TARGET_SIZE} ${FOCUS_RING}`;

/** The icon toolbar button, below 640 px. */
export const TOOLBAR_ICON_BUTTON = `${SHARED} justify-center ${TARGET_TOUCH} ${FOCUS_RING}`;

/** The icon size of a toolbar action at each width. */
export function toolbarIconSize(compact: boolean): number {
  return compact ? 20 : 16;
}

interface PreviewToolbarActionProps {
  /** The leading icon, or the spinner while the action's capture runs. */
  icon: ReactNode;
  /** The visible label, or the accessible name and title of an icon button. */
  label: string;
  /** Below 640 px, where the action is an icon button. */
  compact: boolean;
  /** Whether a capture holds the toolbar, which marks every action disabled. */
  busy: boolean;
  onClick: () => void;
  /** The id a toast action returns focus to. */
  id?: string;
}

export function PreviewToolbarAction({
  icon,
  label,
  compact,
  busy,
  onClick,
  id,
}: PreviewToolbarActionProps) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-disabled={busy}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={compact ? TOOLBAR_ICON_BUTTON : TOOLBAR_BUTTON}
    >
      {icon}
      {compact ? null : label}
    </button>
  );
}
