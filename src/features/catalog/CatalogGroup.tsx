// One subject type heading of the catalog as a disclosure. The heading holds a button
// that names the group and how many courses the filters leave in it, and a collapsed
// group unmounts its cards, so a long group the student set aside costs no render. The
// caller leaves the count out when it would only repeat the catalog summary line, as on
// a single heading result with no filter narrowing it.

import { useId, type ReactNode } from 'react';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import type { Translate } from '@/lib/i18n/t';
import { courseCountLabel } from '@/lib/i18n/counts';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';

interface CatalogGroupProps {
  heading: string;
  /** Courses the filters leave in the group, or null to show the heading alone. */
  count: number | null;
  collapsed: boolean;
  onToggle: () => void;
  t: Translate;
  children: ReactNode;
}

export function CatalogGroup({
  heading,
  count,
  collapsed,
  onToggle,
  t,
  children,
}: CatalogGroupProps) {
  const listId = useId();
  const countLabel = count === null ? null : courseCountLabel(t, count);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-ink-soft">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : listId}
          onClick={onToggle}
          className={`flex w-full items-center gap-1.5 rounded-kcp text-left hover:text-ink ${TARGET_HEIGHT} ${FOCUS_RING}`}
        >
          <DisclosureChevron open={!collapsed} />
          <span className="min-w-0 flex-1">{heading}</span>
          {countLabel === null ? null : (
            <>
              {' '}
              <span className="shrink-0 font-normal">{countLabel}</span>
            </>
          )}
        </button>
      </h3>
      {collapsed ? null : (
        <div id={listId} className="flex flex-col gap-2">
          {children}
        </div>
      )}
    </section>
  );
}
