// Speaks the catalog filter result through the status announcer. The filters narrow the
// list in place without moving focus, so a screen reader user typing a filter or pressing a
// toggle would otherwise hear nothing, not even that no course matches (WCAG 4.1.3). The
// line is spoken once the filter has held still for a moment, so typing a word reads one
// result rather than one per key. Only a filter change arms it: a re-render, a plan change
// that shifts the count, or a language change says nothing.

import { useEffect, useState } from 'react';
import type { CatalogFilter } from '@/lib/catalog/filter';
import { statusStore } from '@/features/shell/statusStore';

/** How long the filter holds still before its result is spoken. */
export const FILTER_ANNOUNCE_MS = 500;

export function useFilterAnnouncement(
  filter: CatalogFilter,
  text: string,
): void {
  const [seen, setSeen] = useState(filter);
  // Counts the filter changes not yet spoken, so each change restarts the wait.
  const [due, setDue] = useState<number | null>(null);
  if (filter !== seen) {
    setSeen(filter);
    setDue((current) => (current ?? 0) + 1);
  }

  useEffect(() => {
    if (due === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDue(null);
      statusStore.getState().say(text);
    }, FILTER_ANNOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [due, text]);
}
