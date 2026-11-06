import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { Layout } from './Layout';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { CatalogToggle } from './CatalogToggle';
import { uiStore } from './uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';

const deps = fakeSearchDeps();

function wrapper({ children }: { children: ReactNode }) {
  return <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>;
}

const TAB_STOPS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
].join(',');

// The elements Tab can land on: focusable, not taken out of the order by a negative
// tabindex, and outside every inert subtree.
function tabStops(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TAB_STOPS)).filter(
    (element) => element.tabIndex >= 0 && element.closest('[inert]') === null,
  );
}

function catalogColumn(container: HTMLElement): HTMLElement {
  const column = container.querySelector<HTMLElement>(`#${CATALOG_COLUMN_ID}`);
  if (column === null) throw new Error('the catalog column is not rendered');
  return column;
}

// The grid region may be the hidden pane, so the lookup includes hidden nodes.
function gridRegion(): HTMLElement {
  const grid = screen.getByRole('group', {
    name: 'ตารางเรียนรายสัปดาห์',
    hidden: true,
  });
  const region = grid.closest<HTMLElement>('.p-4');
  if (region === null) throw new Error('the grid region is not rendered');
  return region;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetPlanStore();
  act(() => {
    uiStore.setState({ mobilePane: null, planView: 'timetable' });
    uiStore.getState().setSheetOpen(false);
    uiStore.getState().setLanguage('th');
    uiStore.getState().setViewMode('edit');
  });
});

describe('Layout', () => {
  it('renders the search, the docked catalog, and the grid regions', () => {
    installViewport(1440);
    render(<Layout />, { wrapper });
    expect(screen.getByRole('tab', { name: 'หลักสูตร' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'ยังไม่มีรายวิชา' }),
    ).toBeInTheDocument();
  });

  it('mounts the catalog once', () => {
    installViewport(1440);
    const { container } = render(<Layout />, { wrapper });
    expect(screen.getAllByText('ยังไม่มีรายวิชา')).toHaveLength(1);
    expect(container.querySelectorAll(`#${CATALOG_COLUMN_ID}`)).toHaveLength(1);
  });

  it.each([
    [1024, 'w-[22rem]'],
    [1280, 'w-96'],
    [1536, 'w-[26rem]'],
  ] as const)(
    'docks the catalog column at %i px with no sheet controls',
    (width, widthClass) => {
      installViewport(width);
      const { container } = render(<Layout />, { wrapper });
      const column = catalogColumn(container);
      expect(column).toHaveClass(widthClass);
      expect(column).not.toHaveAttribute('aria-hidden');
      expect(
        screen.queryByRole('button', { name: 'ปิดรายการรายวิชา' }),
      ).not.toBeInTheDocument();
    },
  );

  it('keeps the catalog sheet hidden at 768 px until it is opened', () => {
    installViewport(768);
    const { container } = render(<Layout />, { wrapper });
    const sheet = catalogColumn(container);
    expect(sheet).toHaveClass('w-[24rem]', 'max-w-[90vw]');
    expect(sheet).toHaveAttribute('aria-hidden', 'true');
    expect(sheet).toHaveAttribute('inert');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    expect(sheet).not.toHaveAttribute('aria-hidden');
    expect(sheet).not.toHaveAttribute('inert');
    expect(
      screen.getByRole('heading', { name: 'ค้นหารายวิชา' }),
    ).toBeInTheDocument();
  });

  it('opens on the catalog pane below 640 px for an empty plan', () => {
    installViewport(390);
    const { container } = render(<Layout />, { wrapper });
    const pane = catalogColumn(container);
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(pane).toHaveClass('col-start-1', 'row-start-1');
    expect(pane).not.toHaveAttribute('role');
    expect(pane).not.toHaveAttribute('inert');
    expect(
      screen.getByRole('heading', { name: 'ค้นหารายวิชา' }),
    ).toBeInTheDocument();
    // The bottom nav switches panes, so the pane carries no close.
    expect(
      screen.queryByRole('button', { name: 'ปิดรายการรายวิชา' }),
    ).not.toBeInTheDocument();

    const region = gridRegion();
    expect(region).toHaveClass('col-start-1', 'row-start-1', 'invisible');
    expect(region).toHaveAttribute('inert');
    expect(region).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.getByRole('navigation', { name: 'ส่วนของตัววางแผน' }),
    ).toBeInTheDocument();
  });

  it('opens on the timetable pane below 640 px when the plan has entries', () => {
    seedActivePlan([makePlanEntry()]);
    installViewport(390);
    const { container } = render(<Layout />, { wrapper });
    expect(uiStore.getState().mobilePane).toBe('plan');
    const pane = catalogColumn(container);
    expect(pane).toHaveClass('invisible');
    expect(pane).toHaveAttribute('inert');
    expect(pane).toHaveAttribute('aria-hidden', 'true');
    expect(gridRegion()).not.toHaveAttribute('inert');
    expect(gridRegion()).not.toHaveClass('invisible');
    expect(screen.getByRole('button', { name: 'ตารางเรียน' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches panes from the nav, keeping both mounted and one reachable', () => {
    installViewport(390);
    const { container } = render(<Layout />, { wrapper });
    const pane = catalogColumn(container);
    const scroller = pane.querySelector<HTMLElement>('[data-catalog-scroller]');
    if (scroller === null) throw new Error('the catalog scroller is missing');
    scroller.scrollTop = 180;

    fireEvent.click(screen.getByRole('button', { name: 'ตารางเรียน' }));
    expect(catalogColumn(container)).toBe(pane);
    expect(pane).toHaveAttribute('inert');
    expect(gridRegion()).not.toHaveAttribute('inert');
    expect(tabStops(container).some((stop) => pane.contains(stop))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'ที่เลือก' }));
    expect(
      screen.getByRole('heading', { name: 'ยังไม่ได้เลือกรายวิชา' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'รายวิชา' }));
    expect(pane).not.toHaveAttribute('inert');
    expect(scroller.scrollTop).toBe(180);
    // The plan pane keeps the selected view for the return, hidden and inert meanwhile.
    const selected = screen.getByRole('heading', {
      name: 'ยังไม่ได้เลือกรายวิชา',
      hidden: true,
    });
    expect(selected.closest('[inert]')).not.toBeNull();
    expect(tabStops(container).some((stop) => pane.contains(stop))).toBe(true);
  });

  it('opens no sheet and no scrim below 640 px', () => {
    seedActivePlan([makePlanEntry()]);
    installViewport(390);
    const { container } = render(<Layout />, { wrapper });
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    expect(container.querySelector('.z-scrim')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gridRegion()).not.toHaveAttribute('inert');
  });

  it('closes the sheet from its header close', () => {
    installViewport(768);
    render(<Layout />, { wrapper });
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    // The scrim carries the same action but is hidden from assistive technology, so the
    // header close is the one named close control.
    const closes = screen.getAllByRole('button', { name: 'ปิดรายการรายวิชา' });
    expect(closes).toHaveLength(1);
    const [close] = closes;
    if (close === undefined) throw new Error('the close control is missing');
    fireEvent.click(close);
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it('closes the sheet from a scrim that is not a tab stop', () => {
    installViewport(768);
    const { container } = render(<Layout />, { wrapper });
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const scrim = container.querySelector<HTMLElement>('.z-scrim');
    if (scrim === null) throw new Error('the scrim is not rendered');
    expect(scrim).toHaveAttribute('tabindex', '-1');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(scrim);
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(container.querySelector('.z-scrim')).toBeNull();
  });

  it('returns focus to the header toggle when the scrim closes the sheet', () => {
    installViewport(768);
    const { container } = render(
      <>
        <CatalogToggle />
        <Layout />
      </>,
      { wrapper },
    );
    const toggle = screen.getByRole('button', { name: 'รายวิชา' });
    toggle.focus();
    fireEvent.click(toggle);
    expect(catalogColumn(container)).toHaveFocus();

    const scrim = container.querySelector<HTMLElement>('.z-scrim');
    if (scrim === null) throw new Error('the scrim is not rendered');
    fireEvent.click(scrim);
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it('makes the grid region inert while the sheet is open', () => {
    installViewport(768);
    const { container } = render(<Layout />, { wrapper });
    const sheet = catalogColumn(container);
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.closest('[inert]')).toBeNull();

    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    expect(grid.closest('[inert]')).not.toBeNull();
    // Tab never reaches the grid: every stop left in the body sits in the sheet.
    const stops = tabStops(container);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((stop) => sheet.contains(stop))).toBe(true);

    act(() => {
      uiStore.getState().setSheetOpen(false);
    });
    expect(grid.closest('[inert]')).toBeNull();
    expect(tabStops(container).some((stop) => sheet.contains(stop))).toBe(
      false,
    );
  });

  it('leaves the grid region operable on a docked tier', () => {
    installViewport(1440);
    render(<Layout />, { wrapper });
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    const grid = screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' });
    expect(grid.closest('[inert]')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps one catalog column element across tier changes', () => {
    const viewport = installViewport(768);
    const { container } = render(<Layout />, { wrapper });
    const sheet = catalogColumn(container);
    act(() => {
      viewport.resize(1440);
    });
    const docked = catalogColumn(container);
    expect(docked).toBe(sheet);
    expect(docked).toHaveClass('w-96');
    act(() => {
      viewport.resize(390);
    });
    expect(catalogColumn(container)).toBe(sheet);
    expect(sheet).toHaveClass('col-start-1');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  describe('the feedback strip', () => {
    // The strip's one live node, told apart from the status announcer and the drag
    // library's region by its polite live attribute.
    function strip(container: HTMLElement): HTMLElement {
      const node = container.querySelector<HTMLElement>(
        '[aria-live="polite"]:not([id^="DndLiveRegion-"]):not([role])',
      );
      if (node === null) throw new Error('the feedback strip is not rendered');
      return node;
    }

    it('sits at the top of the grid column on a docked tier', () => {
      installViewport(1440);
      const { container } = render(<Layout />, { wrapper });
      const node = strip(container);
      // The strip and the grid share the planner region, the strip first.
      const region = node.parentElement;
      if (region === null) throw new Error('the strip has no region');
      expect(
        within(region).getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
      ).toBeInTheDocument();
      expect(node).toHaveClass('min-h-[1.75rem]');
    });

    it('floats over the open sheet outside the inert grid at 768 px', () => {
      installViewport(768);
      const { container } = render(<Layout />, { wrapper });
      act(() => {
        uiStore.getState().setSheetOpen(true);
      });
      const node = strip(container);
      expect(node.closest('[inert]')).toBeNull();
      expect(node).toHaveClass('absolute', 'z-drawer', 'left-4');
      // It follows the scrim in the tree, so at the same layer it paints above it.
      const scrim = container.querySelector('.z-scrim');
      expect(
        scrim !== null &&
          scrim.compareDocumentPosition(node) &
            Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('floats above the bottom nav outside both panes at 390 px', () => {
      installViewport(390);
      const { container } = render(<Layout />, { wrapper });
      const node = strip(container);
      expect(node.closest('[inert]')).toBeNull();
      expect(node).toHaveClass(
        'absolute',
        'z-drawer',
        'bottom-[calc(72px+var(--kcp-safe-bottom))]',
      );
    });

    it('floats at the foot of the grid while the sheet is closed', () => {
      installViewport(768);
      const { container } = render(<Layout />, { wrapper });
      expect(strip(container)).toHaveClass('inset-x-4', 'max-w-[32rem]');
    });
  });

  it('collapses the search and catalog in preview mode', () => {
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    const { container } = render(<Layout />, { wrapper });
    expect(
      screen.queryByRole('tab', { name: 'หลักสูตร' }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(`#${CATALOG_COLUMN_ID}`)).toBeNull();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
  });

  it('shows no bottom nav in preview below 640 px', () => {
    installViewport(390);
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    render(<Layout />, { wrapper });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
