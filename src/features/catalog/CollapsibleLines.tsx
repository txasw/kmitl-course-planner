// A labelled list of text lines that rests as one line. Collapsed, it shows the label
// and the first line clamped to one line; the expand control appears when more lines
// follow or the first line clips, and expanded it lists every line in full. It carries
// no box fill, so a catalog where half the rows hold a line does not turn into a wash
// of tinted boxes. RulesNotice is built on it.
//
// The control is a text button with a 24 px target, 44 px under a coarse pointer, that
// takes the line's own height through a negative margin so the row does not grow for it.
// It stops the pointer down so pressing it never starts a drag of the row it sits in.

import { useId, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { useTruncated } from './useTruncated';

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
  const firstRef = useRef<HTMLLIElement>(null);
  const listId = useId();
  const first = lines[0] ?? '';
  const clipped = useTruncated(firstRef, !expanded, first);
  if (lines.length === 0) {
    return null;
  }
  const expandable = expanded || lines.length > 1 || clipped;
  const shown = expanded ? lines : [first];

  return (
    <div className={`mt-1 flex flex-wrap items-start gap-x-1 ${toneClass}`}>
      <span className="flex shrink-0 items-center gap-1 font-semibold">
        {icon}
        {label}
      </span>
      <ul
        id={listId}
        {...(lang !== undefined ? { lang } : {})}
        className="min-w-0 flex-1 basis-32"
      >
        {shown.map((line, index) => (
          <li
            key={`${String(index)}-${line}`}
            ref={index === 0 ? firstRef : undefined}
            className={expanded ? 'break-words' : 'truncate'}
          >
            {line}
          </li>
        ))}
      </ul>
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
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
