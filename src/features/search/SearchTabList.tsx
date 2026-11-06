// The three official search modes as an underline tablist. Selection follows focus,
// since switching a tab only swaps the fields below and fetches nothing, so the arrow
// keys move between the tabs and choose them in one step. Only the selected tab sits
// in the tab order, so Tab moves from the tablist straight into the fields. The base
// line is an inset shadow rather than a border the tabs overlap, because the overflow
// scroller clips anything past its padding box, which would cut the 2 px indicator to
// 1 px and add a stray pixel of vertical scroll.

import { useRef, type KeyboardEvent } from 'react';
import { SEARCH_TABS, type SearchTab } from '@/lib/search/formState';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { SEARCH_TABPANEL_ID, searchTabId } from './searchIds';
import { TAB_ICON, TAB_LABEL } from './searchTabs';

interface SearchTabListProps {
  activeTab: SearchTab;
  label: string;
  t: Translate;
  onSelect: (tab: SearchTab) => void;
}

/** The index an arrow, Home, or End press moves to, wrapping at either end. */
function targetIndex(index: number, key: string): number | null {
  const count = SEARCH_TABS.length;
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** The tab a navigation key moves to, or null for any other key. */
function nextTab(current: SearchTab, key: string): SearchTab | null {
  const target = targetIndex(SEARCH_TABS.indexOf(current), key);
  return target === null ? null : (SEARCH_TABS[target] ?? null);
}

export function SearchTabList({
  activeTab,
  label,
  t,
  onSelect,
}: SearchTabListProps) {
  const tabRefs = useRef(new Map<SearchTab, HTMLButtonElement>());

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const target = nextTab(activeTab, event.key);
    if (target === null) {
      return;
    }
    event.preventDefault();
    onSelect(target);
    tabRefs.current.get(target)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
    >
      {SEARCH_TABS.map((tab) => {
        const selected = tab === activeTab;
        const Icon = TAB_ICON[tab];
        return (
          <button
            key={tab}
            ref={(node) => {
              if (node === null) {
                tabRefs.current.delete(tab);
              } else {
                tabRefs.current.set(tab, node);
              }
            }}
            id={searchTabId(tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={SEARCH_TABPANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onSelect(tab);
            }}
            onKeyDown={handleKeyDown}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-sm whitespace-nowrap pointer-coarse:min-h-11 ${FOCUS_RING} ${
              selected
                ? 'border-primary font-semibold text-primary-strong'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />
            {t(TAB_LABEL[tab])}
          </button>
        );
      })}
    </div>
  );
}
