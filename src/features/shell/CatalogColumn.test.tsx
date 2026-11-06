import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect, useRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import type * as DndKit from '@dnd-kit/core';
import type { UniqueIdentifier, UseDraggableArguments } from '@dnd-kit/core';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { searchStore } from '@/features/search/searchStore';
import { catalogStore } from '@/features/catalog/catalogStore';
import { EMPTY_DISCLOSURE } from '@/lib/catalog/cardDisclosure';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { useLayoutTier } from './useLayoutTier';
import { dragStore } from '@/features/planner/dragStore';
import { CatalogColumn, SheetScrim } from './CatalogColumn';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { CatalogToggle } from './CatalogToggle';
import { EdgeRail } from './EdgeRail';
import { uiStore } from './uiStore';
import { useFocusTrap } from './useFocusTrap';

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

const ownerQuery: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  selected_subject_owner_id: '32',
};

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

// The edge rail takes the hidden column's place and restores it, so the focus hand off
// between the two is exercised with both mounted, in the order Layout renders them.
function ShellHarness() {
  const tier = useLayoutTier();
  return (
    <SearchDepsProvider value={fakeSearchDeps()}>
      <DndContext>
        <CatalogColumn tier={tier} />
        <EdgeRail />
      </DndContext>
    </SearchDepsProvider>
  );
}

// The overlay in miniature: a trapped panel that closes on Escape, holding the header
// toggle and the column, so a test proves which layer each Escape press closes.
function OverlayHarness({ onOverlayEscape }: { onOverlayEscape: () => void }) {
  const tier = useLayoutTier();
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, onOverlayEscape);
  return (
    <SearchDepsProvider value={fakeSearchDeps()}>
      <DndContext>
        <div ref={panel} role="dialog" aria-label="overlay" tabIndex={-1}>
          <CatalogToggle />
          <CatalogColumn tier={tier} />
        </div>
      </DndContext>
    </SearchDepsProvider>
  );
}

function openSheetFromToggle(): HTMLElement {
  const toggle = screen.getByRole('button', { name: 'รายวิชา' });
  toggle.focus();
  fireEvent.click(toggle);
  expect(uiStore.getState().sheetOpen).toBe(true);
  return toggle;
}

function column(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>(`#${CATALOG_COLUMN_ID}`);
  if (node === null) throw new Error('the catalog column is not rendered');
  return node;
}

function scroller(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>(
    `#${CATALOG_COLUMN_ID} > .kcp-scroll`,
  );
  if (node === null) throw new Error('the catalog scroller is not rendered');
  return node;
}

// Cards start collapsed and mount no section rows, so the section drag surfaces are
// counted after every card is opened.
function expandAll(container: HTMLElement): void {
  for (const node of container.querySelectorAll<HTMLElement>(
    '[data-course-toggle][aria-expanded="false"]',
  )) {
    fireEvent.click(node);
  }
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
    catalogStore.setState({ disclosure: EMPTY_DISCLOSURE });
    searchStore.getState().cancelSearch();
    uiStore.getState().setSheetOpen(false);
    uiStore.getState().setCatalogVisible(true);
    dragStore.getState().clearActive();
    dragStore.getState().clearCourse();
    dragStore.getState().clearBlockMove();
  });
});

const dragged = catalog.courses[0];

function startSectionDrag(): void {
  const section = dragged?.sections[0];
  if (dragged === undefined || section === undefined) {
    throw new Error('the dragged course is missing');
  }
  act(() => {
    dragStore.getState().start(dragged, section, []);
  });
}

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
      expect(sectionRegistrations()).toEqual({ t1: 0, t2: 0, t3: 0 });
      expandAll(container);
      expect(sectionRegistrations()).toEqual({ t1: 1, t2: 1, t3: 1 });
      expect(
        container.querySelectorAll('[data-drag-surface="section"]'),
      ).toHaveLength(SECTION_IDS.length);
    },
  );

  it('marks the scroller that owns its scroll anchoring', () => {
    installViewport(1440);
    const { container } = render(<Harness />);
    const node = scroller(container);
    expect(node).toHaveAttribute('data-catalog-scroller');
    expect(node).toHaveClass('[overflow-anchor:none]');
  });

  it('keeps the drag registrations and the scroll offset across tier changes', () => {
    const viewport = installViewport(768);
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    const { container } = render(<Harness />);
    expandAll(container);
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

  it('hides the docked column out of the flow and keeps it mounted and inert', () => {
    installViewport(1440);
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    const { container } = render(<Harness />);
    expandAll(container);
    const node = column(container);
    const scroll = scroller(container);
    scroll.scrollTop = 240;
    expect(node).toHaveClass('shrink-0', 'w-96');
    expect(node).not.toHaveAttribute('inert');

    fireEvent.click(screen.getByRole('button', { name: 'ซ่อนรายวิชา' }));
    expect(uiStore.getState().catalogVisible).toBe(false);
    expect(column(container)).toBe(node);
    expect(node).toHaveClass('invisible', 'absolute', 'w-96');
    expect(node).not.toHaveClass('shrink-0');
    expect(node).toHaveAttribute('inert');
    expect(node).toHaveAttribute('aria-hidden', 'true');
    expect(scroller(container)).toBe(scroll);
    expect(scroll.scrollTop).toBe(240);
    expect(sectionRegistrations()).toEqual({ t1: 1, t2: 1, t3: 1 });

    act(() => {
      uiStore.getState().setCatalogVisible(true);
    });
    expect(node).toHaveClass('shrink-0');
    expect(node).not.toHaveAttribute('inert');
    expect(node).not.toHaveAttribute('aria-hidden');
    expect(scroll.scrollTop).toBe(240);
  });

  it('keeps the closed sheet mounted and inert, and opens it in place', () => {
    installViewport(768);
    const { container } = render(<Harness />);
    const node = column(container);
    expect(node).toHaveAttribute('inert');
    expect(node).toHaveAttribute('aria-hidden', 'true');
    expect(node).toHaveClass('-translate-x-full');

    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    expect(column(container)).toBe(node);
    expect(node).not.toHaveAttribute('inert');
    expect(node).not.toHaveAttribute('aria-hidden');
    expect(node).toHaveClass('translate-x-0');

    act(() => {
      uiStore.getState().setSheetOpen(false);
    });
    expect(node).toHaveAttribute('inert');
    expect(node).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens the sheet as a labelled dialog that takes focus and wraps Tab', () => {
    installViewport(768);
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    const { container } = render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const sheet = screen.getByRole('dialog', { name: 'ค้นหารายวิชา' });
    expect(sheet).toBe(column(container));
    expect(sheet).toHaveFocus();

    const stops = Array.from(
      sheet.querySelectorAll<HTMLElement>('button:not([disabled]),input'),
    ).filter(
      (element) => element.tabIndex >= 0 && element.closest('[inert]') === null,
    );
    const first = stops[0];
    const last = stops.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error('the sheet has no tab stops');
    }
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('closes only the sheet on Escape and returns focus to the header toggle', () => {
    installViewport(768);
    const onOverlayEscape = vi.fn();
    render(<OverlayHarness onOverlayEscape={onOverlayEscape} />);
    const toggle = openSheetFromToggle();
    const sheet = screen.getByRole('dialog', { name: 'ค้นหารายวิชา' });
    expect(sheet).toHaveFocus();

    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(onOverlayEscape).not.toHaveBeenCalled();
    expect(toggle).toHaveFocus();

    // With the sheet closed, the next Escape belongs to the overlay.
    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(onOverlayEscape).toHaveBeenCalledOnce();
  });

  it('leaves the Escape that ends a composition to the editor', () => {
    installViewport(768);
    const onOverlayEscape = vi.fn();
    render(<OverlayHarness onOverlayEscape={onOverlayEscape} />);
    openSheetFromToggle();
    const sheet = screen.getByRole('dialog', { name: 'ค้นหารายวิชา' });

    fireEvent.keyDown(sheet, { key: 'Escape', isComposing: true });
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(onOverlayEscape).not.toHaveBeenCalled();
  });

  it('lets an open list inside the sheet claim Escape before the sheet', () => {
    installViewport(768);
    const onOverlayEscape = vi.fn();
    render(<OverlayHarness onOverlayEscape={onOverlayEscape} />);
    openSheetFromToggle();
    const semester = screen.getByRole('combobox', { name: 'ภาคการศึกษา' });
    fireEvent.keyDown(semester, { key: 'ArrowDown' });
    expect(semester).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(semester, { key: 'Escape' });
    expect(semester).toHaveAttribute('aria-expanded', 'false');
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(onOverlayEscape).not.toHaveBeenCalled();

    fireEvent.keyDown(semester, { key: 'Escape' });
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(onOverlayEscape).not.toHaveBeenCalled();
  });

  it('returns focus to the header toggle from the sheet close', () => {
    installViewport(768);
    render(<OverlayHarness onOverlayEscape={vi.fn()} />);
    const toggle = openSheetFromToggle();
    const close = screen.getByRole('button', { name: 'ปิดรายการรายวิชา' });
    close.focus();
    fireEvent.click(close);
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it('leaves Escape to the overlay on a docked tier', () => {
    installViewport(1440);
    const onOverlayEscape = vi.fn();
    const { container } = render(
      <OverlayHarness onOverlayEscape={onOverlayEscape} />,
    );
    const hide = screen.getByRole('button', { name: 'ซ่อนรายวิชา' });
    hide.focus();
    fireEvent.keyDown(hide, { key: 'Escape' });
    expect(onOverlayEscape).toHaveBeenCalledOnce();
    expect(column(container)).not.toHaveAttribute('inert');
  });

  it('renders the docked column as no dialog', () => {
    installViewport(1440);
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const { container } = render(<Harness />);
    const node = column(container);
    expect(node).not.toHaveAttribute('role');
    expect(node).not.toHaveAttribute('tabindex');
    expect(node).not.toHaveFocus();
  });

  it('starts the hide control at the leading edge of a 48 px header row', () => {
    installViewport(1440);
    render(<Harness />);
    const hide = screen.getByRole('button', { name: 'ซ่อนรายวิชา' });
    expect(hide.parentElement).toHaveClass('h-12', 'justify-start');
    expect(hide.parentElement).not.toHaveClass('pl-4', 'px-4');
    expect(hide.firstElementChild).toHaveClass('w-11', 'justify-center');
  });

  it('carries the slide shadow on its own inert child on the docked tiers only', () => {
    const viewport = installViewport(1440);
    const { container } = render(<Harness />);
    const node = column(container);
    expect(node).toHaveClass('relative', 'shrink-0');
    const shadow = node.querySelector('[data-catalog-shadow]');
    expect(shadow).toHaveAttribute('aria-hidden', 'true');
    expect(shadow).toHaveClass(
      'pointer-events-none',
      'absolute',
      'inset-0',
      'opacity-0',
      'shadow-kcp',
    );

    act(() => {
      viewport.resize(768);
    });
    expect(node.querySelector('[data-catalog-shadow]')).toBeNull();
  });

  it('leaves the sheet tiers to the sheet state while the docked column is hidden', () => {
    const viewport = installViewport(1440);
    const { container } = render(<Harness />);
    // The sheet was opened on a narrow window, then the window widened and the docked
    // column was hidden, so the sheet state is open while the docked choice is hidden.
    act(() => {
      uiStore.getState().setSheetOpen(true);
      uiStore.getState().setCatalogVisible(false);
    });
    act(() => {
      viewport.resize(768);
    });
    const node = column(container);
    expect(node).not.toHaveClass('invisible');
    expect(node).not.toHaveAttribute('inert');
    expect(
      screen.queryByRole('button', { name: 'ซ่อนรายวิชา' }),
    ).not.toBeInTheDocument();
  });

  it('yields the open sheet to a 24 px peek during a section drag and returns it', () => {
    installViewport(768);
    const { container } = render(<Harness />);
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const node = column(container);
    const list = scroller(container);
    list.scrollTop = 180;

    startSectionDrag();
    expect(node).toHaveAttribute('data-yielded', 'true');
    expect(node).toHaveClass('translate-x-[calc(24px-100%)]');
    expect(node).toHaveClass('motion-reduce:transition-none');

    act(() => {
      dragStore.getState().clearActive();
    });
    expect(node).not.toHaveAttribute('data-yielded');
    expect(node).toHaveClass('translate-x-0');
    expect(scroller(container)).toBe(list);
    expect(list.scrollTop).toBe(180);
  });

  it('yields during a course drag but not during a block drag', () => {
    installViewport(768);
    const { container } = render(<Harness />);
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const node = column(container);
    if (dragged === undefined) throw new Error('the dragged course is missing');

    act(() => {
      dragStore.getState().startCourse(dragged, []);
    });
    expect(node).toHaveAttribute('data-yielded', 'true');

    const placed = dragged.sections[0];
    if (placed === undefined) throw new Error('the placed section is missing');
    act(() => {
      dragStore.getState().startBlockMove(placed, [placed], dragged);
    });
    expect(node).not.toHaveAttribute('data-yielded');
  });

  it('never moves the docked column for a drag', () => {
    installViewport(1440);
    const { container } = render(<Harness />);
    startSectionDrag();
    const node = column(container);
    expect(node).not.toHaveAttribute('data-yielded');
    expect(node).not.toHaveClass('translate-x-[calc(24px-100%)]');
  });

  it('fades the scrim and lets the pointer through while the sheet yields', () => {
    installViewport(768);
    const { container } = render(<SheetScrim tier="medium" />);
    expect(container.querySelector('button')).toBeNull();
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const scrim = container.querySelector('button');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    expect(scrim).not.toHaveClass('opacity-0');

    startSectionDrag();
    expect(scrim).toHaveClass('pointer-events-none', 'opacity-0');
    expect(scrim).toHaveClass('motion-reduce:transition-none');

    act(() => {
      dragStore.getState().clearActive();
    });
    expect(scrim).not.toHaveClass('opacity-0');
  });

  it('keeps the results offset across the fold and resets it on a new search', () => {
    installViewport(1440);
    const { container } = render(<Harness />);
    act(() => {
      searchStore.getState().startQuery(ownerQuery, 'user');
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, ownerQuery);
    });
    const node = scroller(container);
    expect(node).toHaveClass('min-h-0');
    node.scrollTop = 240;

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขการค้นหา' }));
    expect(node).toHaveClass('min-h-48');
    expect(node.scrollTop).toBe(240);
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขการค้นหา' }));
    expect(node).toHaveClass('min-h-0');
    expect(node.scrollTop).toBe(240);

    act(() => {
      searchStore.getState().startQuery({ ...ownerQuery }, 'user');
    });
    expect(scroller(container)).toBe(node);
    expect(node.scrollTop).toBe(0);
  });

  it('hands focus between the hide control and the edge rail', () => {
    installViewport(1440);
    render(<ShellHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'ซ่อนรายวิชา' }));
    const rail = screen.getByRole('button', { name: 'แสดงรายวิชา' });
    expect(rail).toHaveFocus();

    // A keyboard activation, whose detail is 0, is never held back by the pointer guard.
    fireEvent.click(rail, { detail: 0 });
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'แสดงรายวิชา' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ซ่อนรายวิชา' })).toHaveFocus();
  });
});
