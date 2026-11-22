// The instructor line of a change section choice (ADR-0068 amendment of 2026-11-22). It is
// one row that scrolls sideways, ending in a fade and an ellipsis while names lie past its
// edge (the kcp-more layer in the shadow sheet). Only a line that holds more than it shows
// is a named region and a tab stop, the scrollable region pattern, so a keyboard scrolls it
// with the arrow keys. The region is named per choice, so the landmarks of a long list stay
// apart. The list itself carries no name: the choice's select button names it as its
// description, and a referenced element's own name would replace its text there. This line
// is the owner approved exception to the no ellipsis rule (ADR-0048 amendment of
// 2026-11-22).

import { useLayoutEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';

interface Fit {
  /** The line holds more than it shows. */
  wide: boolean;
  /** Names still lie past the end of the line. */
  more: boolean;
}

function readFit(node: HTMLElement, previous: Fit): Fit {
  const wide = node.scrollWidth > node.clientWidth + 1;
  const more = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
  return previous.wide === wide && previous.more === more
    ? previous
    : { wide, more };
}

interface TeacherScrollProps {
  /** The id the select button names as its description. */
  id: string;
  names: string[];
  /** The region name, which names the choice the line belongs to. */
  regionLabel: string;
}

export function TeacherScroll({ id, names, regionLabel }: TeacherScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState<Fit>({ wide: false, more: false });
  const key = names.join(', ');
  useLayoutEffect(() => {
    const node = scrollRef.current;
    const list = listRef.current;
    if (node === null || list === null) return undefined;
    // An observer reports once as it starts, so a new list is measured as well. The list
    // is observed too, since a late font swap widens it without resizing the line.
    const observer = new ResizeObserver(() => {
      setFit((previous) => readFit(node, previous));
    });
    observer.observe(node);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [key]);
  return (
    <div
      className={`relative flex items-center gap-1 px-2 pb-1.5 text-ink-soft ${fit.more ? 'kcp-more' : ''}`}
    >
      <UserRound size={12} aria-hidden className="shrink-0" />
      <div
        ref={scrollRef}
        data-teacher-scroll
        role={fit.wide ? 'region' : undefined}
        aria-label={fit.wide ? regionLabel : undefined}
        tabIndex={fit.wide ? 0 : undefined}
        onScroll={(event) => {
          const node = event.currentTarget;
          setFit((previous) => readFit(node, previous));
        }}
        className={`kcp-scroll min-w-0 flex-1 overflow-x-auto rounded-kcp-inner ${FOCUS_RING}`}
      >
        <ul
          ref={listRef}
          id={id}
          className="flex w-max gap-1 whitespace-nowrap"
        >
          {names.map((name, index) => (
            <li key={name}>
              {name}
              {index < names.length - 1 ? ',' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
