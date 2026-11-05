import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import type * as DndKit from '@dnd-kit/core';
import type { UniqueIdentifier, UseDraggableArguments } from '@dnd-kit/core';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import { searchStore } from '@/features/search/searchStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { useLayoutTier } from './useLayoutTier';
import { CatalogColumn, CATALOG_COLUMN_ID } from './CatalogColumn';
import { uiStore } from './uiStore';

// Every mounted useDraggable call counts against its id while it stays mounted, so a
// second copy of the catalog anywhere in the tree would show as a count of two.
const registrations = vi.hoisted(() => new Map<UniqueIdentifier, number>());

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKit>();
  return {
    ...actual,
    useDraggable: (args: UseDraggableArguments) => {
      useEffect(() => {
        registrations.set(args.id, (registrations.get(args.id) ?? 0) + 1);
        return () => {
          registrations.set(args.id, (registrations.get(args.id) ?? 1) - 1);
        };
      }, [args.id]);
      return actual.useDraggable(args);
    },
  };
});

const SECTION_IDS = ['t1', 't2', 't3'];

const catalog: NormalizedCatalog = {
  courses: [
    makeCourse({
      subjectId: '90000001',
      sections: [
        makeSection({ teachTableId: 't1', subjectId: '90000001' }),
        makeSection({
          teachTableId: 't2',
          subjectId: '90000001',
          section: '902',
        }),
      ],
    }),
    makeCourse({
      subjectId: '90000002',
      sections: [makeSection({ teachTableId: 't3', subjectId: '90000002' })],
    }),
  ],
  duplicateCount: 0,
  multiMeetingCount: 0,
  warnings: [],
};

function Harness() {
  const tier = useLayoutTier();
  return (
    <SearchDepsProvider value={fakeSearchDeps()}>
      <DndContext>
        <CatalogColumn tier={tier} />
      </DndContext>
    </SearchDepsProvider>
  );
}

function scroller(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>(
    `#${CATALOG_COLUMN_ID} > .kcp-scroll`,
  );
  if (node === null) throw new Error('the catalog scroller is not rendered');
  return node;
}

function sectionRegistrations(): Record<string, number> {
  return Object.fromEntries(
    SECTION_IDS.map((id) => [id, registrations.get(id) ?? 0]),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  registrations.clear();
  act(() => {
    searchStore.getState().setResult({ status: 'idle' }, null);
    uiStore.getState().setSheetOpen(false);
  });
});

describe('CatalogColumn', () => {
  it.each([
    ['compact', 390],
    ['medium', 768],
    ['wide', 1440],
  ] as const)(
    'registers one drag surface per section at the %s tier',
    (_tier, width) => {
      installViewport(width);
      act(() => {
        searchStore
          .getState()
          .setResult({ status: 'ready', data: catalog }, null);
      });
      const { container } = render(<Harness />);
      expect(sectionRegistrations()).toEqual({ t1: 1, t2: 1, t3: 1 });
      expect(
        container.querySelectorAll('[data-drag-surface="section"]'),
      ).toHaveLength(SECTION_IDS.length);
    },
  );

  it('keeps the drag registrations and the scroll offset across tier changes', () => {
    const viewport = installViewport(768);
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    const { container } = render(<Harness />);
    const node = scroller(container);
    node.scrollTop = 240;

    for (const width of [1440, 390, 1024]) {
      act(() => {
        viewport.resize(width);
      });
      expect(scroller(container)).toBe(node);
      expect(node.scrollTop).toBe(240);
      expect(sectionRegistrations()).toEqual({ t1: 1, t2: 1, t3: 1 });
    }
  });

  it('shows the sheet header with the result count only on a sheet tier', () => {
    const viewport = installViewport(768);
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    const { container } = render(<Harness />);
    const column = container.querySelector(`#${CATALOG_COLUMN_ID}`);
    expect(column).toHaveTextContent('ค้นหารายวิชา');
    expect(column).toHaveTextContent('2 รายวิชา');

    act(() => {
      viewport.resize(1280);
    });
    expect(column).not.toHaveTextContent('ค้นหารายวิชา');
  });
});
