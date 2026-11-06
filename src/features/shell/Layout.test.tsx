import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { Layout } from './Layout';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { CatalogToggle } from './CatalogToggle';
import { uiStore } from './uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
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

  it.each([390, 768])(
    'keeps the catalog sheet hidden at %i px until it is opened',
    (width) => {
      installViewport(width);
      const { container } = render(<Layout />, { wrapper });
      const sheet = catalogColumn(container);
      expect(sheet).toHaveClass('w-[24rem]', 'max-w-[90vw]');
      expect(sheet).toHaveAttribute('aria-hidden', 'true');
      expect(sheet).toHaveAttribute('inert');

      act(() => {
        uiStore.getState().setSheetOpen(true);
      });
      expect(sheet).not.toHaveAttribute('aria-hidden');
      expect(sheet).not.toHaveAttribute('inert');
      expect(
        screen.getByRole('heading', { name: 'ค้นหารายวิชา' }),
      ).toBeInTheDocument();
    },
  );

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

  it('keeps one catalog column element across a tier change', () => {
    const viewport = installViewport(768);
    const { container } = render(<Layout />, { wrapper });
    const sheet = catalogColumn(container);
    act(() => {
      viewport.resize(1440);
    });
    const docked = catalogColumn(container);
    expect(docked).toBe(sheet);
    expect(docked).toHaveClass('w-96');
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
});
