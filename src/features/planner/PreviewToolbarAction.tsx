// One action button of the preview toolbar, in one of two weights (ADR-0022 amendment of
// 2026-11-21). The primary weight is the one filled action of the export page, download, and
// keeps its label at every width. The secondary weight is an outline button: from 640 px up a
// labelled button with its glyph before the label, and below 640 px a cell of the phone action
// row with its glyph over a short label, at the 44 px touch size at every pointer, so every
// action shows what it does without a hover. Where the short label is a shorter form of the
// name, the button keeps the full name as its accessible name, which starts with or holds the
// short label. A busy action is marked aria-disabled rather than disabled, so the focused
// button keeps focus through a capture, and ignores presses until the toolbar is free. The
// running action keeps its full color, with its spinner and busy label, while the others dim.
// The busy label is short, so it fits the width the idle label sets; where it is a shorter
// form of the work in progress, the full form is the accessible name while it runs.

import type { LucideIcon } from 'lucide-react';
import { BusyContent } from '@/components/BusyContent';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE, TARGET_TOUCH } from '@/lib/ui/target';

const BUSY =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-busy:opacity-100!';

const OUTLINE = `rounded-kcp border border-border bg-surface text-ink hover:bg-surface-alt ${BUSY} aria-disabled:hover:bg-surface`;

/** The labelled outline toolbar button, from 640 px up. */
const TOOLBAR_BUTTON = `${OUTLINE} inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm ${TARGET_SIZE} ${FOCUS_RING}`;

/** A cell of the phone action row: the glyph over a short label that may wrap, below 640 px. */
const TOOLBAR_CELL = `${OUTLINE} flex w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs ${TARGET_TOUCH} ${FOCUS_RING}`;

/** The one filled action, labelled at every width and the full row wide on a phone. */
const TOOLBAR_PRIMARY = `inline-flex items-center justify-center gap-1.5 rounded-kcp bg-primary-strong px-3 py-1.5 text-sm font-semibold text-surface shadow-kcp-soft hover:bg-primary-hover ${BUSY} aria-disabled:hover:bg-primary-strong ${FOCUS_OUTLINE}`;

/** The icon size of a toolbar action at each width. */
export function toolbarIconSize(compact: boolean): number {
  return compact ? 20 : 16;
}

type ToolbarWeight = 'primary' | 'secondary';

interface PreviewToolbarActionProps {
  /** The leading icon, which turns into a spinner while the action runs. */
  icon: LucideIcon;
  /** The full name of the action, its visible label from 640 px up. */
  label: string;
  /** The label a phone action row cell shows, when it is shorter than the full name. */
  shortLabel?: string;
  /** The short label while the action runs, naming the work in progress. */
  busyLabel: string;
  /** The accessible name while the action runs, when it is longer than the busy label. */
  busyName?: string;
  /** Whether this action's work is the one running. */
  running: boolean;
  /** Below 640 px, where the toolbar runs along the panel foot. */
  compact: boolean;
  weight: ToolbarWeight;
  /** Whether a running action holds the toolbar, which marks every action disabled. */
  busy: boolean;
  onClick: () => void;
  /** The id a toast action returns focus to. */
  id?: string;
}

/** The classes of a toolbar action, shared with the display options trigger. */
export function toolbarActionClass(
  weight: ToolbarWeight,
  compact: boolean,
): string {
  if (weight === 'primary') {
    return compact
      ? `${TOOLBAR_PRIMARY} w-full ${TARGET_TOUCH}`
      : `${TOOLBAR_PRIMARY} ${TARGET_SIZE}`;
  }
  return compact ? TOOLBAR_CELL : TOOLBAR_BUTTON;
}

export function PreviewToolbarAction({
  icon,
  label,
  shortLabel,
  busyLabel,
  busyName,
  running,
  compact,
  weight,
  busy,
  onClick,
  id,
}: PreviewToolbarActionProps) {
  const cell = compact && weight === 'secondary';
  const visible = cell && shortLabel !== undefined ? shortLabel : label;
  return (
    <button
      id={id}
      type="button"
      onClick={busy ? undefined : onClick}
      aria-disabled={busy}
      aria-busy={running}
      aria-label={running ? busyName : visible === label ? undefined : label}
      className={toolbarActionClass(weight, compact)}
    >
      <BusyContent
        icon={icon}
        size={toolbarIconSize(compact)}
        label={visible}
        busyLabel={busyLabel}
        busy={running}
        className={cell ? 'w-full text-center' : 'text-left'}
      />
    </button>
  );
}
