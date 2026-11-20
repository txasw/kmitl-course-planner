// A labelled list of text lines that rests at two wrapped lines. Collapsed, it shows the
// label and the lines run together, wrapping, clamped at two lines; the expand control
// appears only when the text is longer than that, and expanded it lists every line in
// full. A short list therefore shows whole with no control at all. It carries
// no box fill, so a catalog where half the rows hold a line does not turn into a wash
// of tinted boxes. TeacherLine, RulesNotice, and RemarkLine are built on it.
//
// The control is a text button with a 24 px target, 44 px under a coarse pointer, that
// takes the line's own height through a negative margin so the row does not grow for it.
// It stops the press events so pressing it never starts a drag of the row it sits in.

import { useId, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { NO_DRAG_ARMING } from '@/features/planner/dragArming';
import { useTruncated } from './useTruncated';

/** The lines a collapsed list shows, matching the line-clamp-2 class below. */
const CLAMP_LINES = 2;

interface CollapsibleLinesProps {
  icon: ReactNode;
  label: string;
  lines: string[];
  /** The language of the lines when it can differ from the panel locale. */
  lang?: Locale | undefined;
  /** The text colour class of the label and lines. */
  toneClass: string;
  /** The control text while collapsed, for example the count of hidden rules. */
  expandLabel: string;
  /** The control text while expanded. */
  collapseLabel: string;
}

export function CollapsibleLines({
  icon,
  label,
  lines,
  lang,
  toneClass,
  expandLabel,
  collapseLabel,
}: CollapsibleLinesProps) {
  const [expanded, setExpanded] = useState(false);
  const restRef = useRef<HTMLLIElement>(null);
  const listId = useId();
  // Collapsed, the lines share one item that keeps their breaks, so the two line clamp
  // counts every line and the measure sees all the text.
  const joined = lines.join('\n');
  const clipped = useTruncated(restRef, !expanded, joined);
  if (lines.length === 0) {
    return null;
  }
  // More lines than the clamp holds always hide some; two lines may or may not fit.
  const expandable = expanded || lines.length > CLAMP_LINES || clipped;

  return (
    <div
      data-collapsible-lines={expanded ? 'expanded' : 'collapsed'}
      className={`mt-1 flex flex-wrap items-start gap-x-1 ${toneClass}`}
    >
      <span className="flex shrink-0 items-center gap-1 font-semibold">
        {icon}
        {label}
      </span>
      <ul
        id={listId}
        {...(lang !== undefined ? { lang } : {})}
        className="min-w-0 flex-1 basis-32"
      >
        {expanded ? (
          lines.map((line, index) => (
            <li key={`${String(index)}-${line}`} className="break-words">
              {line}
            </li>
          ))
        ) : (
          <li
            ref={restRef}
            className="line-clamp-2 break-words whitespace-pre-line"
          >
            {joined}
          </li>
        )}
      </ul>
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          {...NO_DRAG_ARMING}
          onClick={() => {
            setExpanded((value) => !value);
          }}
          className={`-my-1 inline-flex min-h-6 shrink-0 items-center rounded-kcp-inner px-1 text-ink-soft underline underline-offset-2 hover:text-ink pointer-coarse:-my-3.5 pointer-coarse:min-h-11 ${FOCUS_RING}`}
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      ) : null}
    </div>
  );
}
