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
import { CATALOG_COLUMN_ID } from './CatalogColumn';
import { uiStore } from './uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';

const deps = fakeSearchDeps();

function wrapper({ children }: { children: ReactNode }) {
  return <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>;
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
    expect(
      screen.getByRole('button', { name: 'หลักสูตรและชั้นปี' }),
    ).toBeInTheDocument();
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

  it.each([
    ['its header close', 0],
    ['its scrim', 1],
  ] as const)('closes the sheet from %s', (_name, index) => {
    installViewport(768);
    render(<Layout />, { wrapper });
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    // The header close comes first in the DOM and the scrim, over the grid, last.
    const closes = screen.getAllByRole('button', { name: 'ปิดรายการรายวิชา' });
    expect(closes).toHaveLength(2);
    const target = closes[index];
    if (target === undefined) throw new Error('the close control is missing');
    fireEvent.click(target);
    expect(uiStore.getState().sheetOpen).toBe(false);
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
      screen.queryByRole('button', { name: 'หลักสูตรและชั้นปี' }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(`#${CATALOG_COLUMN_ID}`)).toBeNull();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
  });
});
