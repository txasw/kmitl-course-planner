import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { Layout } from './Layout';
import { uiStore } from './uiStore';

// The live region inventory of ADR-0048 is a closed set: every node that announces is
// listed here with the outcomes it owns, so a later feature adds its announcement to an
// existing owner rather than a new region that would read an outcome twice. A change to
// this table is a change to the record.
const INVENTORY: Readonly<Record<string, number>> = {
  // Settled search outcomes for user submits, and the settle of a manual plan check.
  'features/shell/StatusAnnouncer.tsx': 1,
  // Placement outcomes and the added line while the timetable is in view.
  'features/planner/FeedbackStrip.tsx': 1,
  // Ordinary toasts, the undo toast it hosts, and an add over the covered timetable.
  'features/shell/Toaster.tsx': 1,
  // The busy status of a query in flight, which unmounts before the outcome.
  'features/catalog/CatalogPanel.tsx': 1,
  // The scoped node of a modal that hides the persistent regions while it is open.
  'features/planner/SuggestDialog.tsx': 1,
  // Error alerts of the recovery and quarantine cards.
  'components/PanelRecoveryCard.tsx': 1,
  'features/plans/QuarantineCard.tsx': 1,
};

// The drag library mounts one region of its own inside the drag context, which no source
// file declares. It speaks the drag lifecycle only, so it is counted apart.
const DND_REGION = '[id^="DndLiveRegion-"]';

/** The status announcer: the panel's one status node that is not the library's. */
const ANNOUNCER = `[role="status"]:not(${DND_REGION})`;

const LIVE_MARKER =
  /\baria-live=|\brole="(?:status|alert|log|marquee|timer)"|<output\b/g;

const SRC_DIR = resolve(process.cwd(), 'src');

function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return componentFiles(full);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [full] : [];
  });
}

function liveRegionsInSource(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of componentFiles(SRC_DIR)) {
    const count = readFileSync(file, 'utf8').match(LIVE_MARKER)?.length ?? 0;
    if (count > 0) {
      found[relative(SRC_DIR, file).split(sep).join('/')] = count;
    }
  }
  return found;
}

const deps = fakeSearchDeps();

function wrapper({ children }: { children: ReactNode }) {
  return <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>;
}

/** The live nodes the panel itself renders, without the drag library's region. */
function panelLiveNodes(container: HTMLElement): Element[] {
  return [
    ...container.querySelectorAll(
      '[aria-live], [role="status"], [role="alert"], [role="log"]',
    ),
  ].filter((node) => !node.matches(DND_REGION));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().setSheetOpen(false);
  });
});

describe('the live region inventory', () => {
  it('matches the set ADR-0048 documents', () => {
    expect(liveRegionsInSource()).toEqual(INVENTORY);
  });

  it.each([390, 768, 1024, 1440])(
    'mounts the announcer once beside the catalog column at %i px',
    (width) => {
      installViewport(width);
      const { container } = render(<Layout />, { wrapper });
      // The idle edit layout carries the two persistent panel regions and no other.
      const nodes = panelLiveNodes(container);
      expect(nodes).toHaveLength(2);
      const statuses = nodes.filter((node) => node.matches('[role="status"]'));
      expect(statuses).toHaveLength(1);
      expect(statuses[0]?.closest(`#${CATALOG_COLUMN_ID}`) ?? null).toBeNull();
      expect(container.querySelectorAll(DND_REGION)).toHaveLength(1);
    },
  );

  it('mounts the announcer once in preview, for the settle of a manual check', () => {
    installViewport(1366);
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    try {
      const { container } = render(<Layout />, { wrapper });
      expect(container.querySelectorAll(ANNOUNCER)).toHaveLength(1);
    } finally {
      act(() => {
        uiStore.getState().setViewMode('edit');
      });
    }
  });

  it('keeps the announcer reachable while the sheet covers the grid', () => {
    installViewport(768);
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const { container } = render(<Layout />, { wrapper });
    const announcer = container.querySelector(ANNOUNCER);
    expect(
      announcer?.closest('[inert], [aria-hidden="true"]') ?? null,
    ).toBeNull();
  });

  it('keeps the announcer reachable while the docked column is hidden', () => {
    installViewport(1440);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    try {
      const { container } = render(<Layout />, { wrapper });
      const announcer = container.querySelector(ANNOUNCER);
      expect(
        announcer?.closest('[inert], [aria-hidden="true"]') ?? null,
      ).toBeNull();
    } finally {
      act(() => {
        uiStore.getState().setCatalogVisible(true);
      });
    }
  });
});
