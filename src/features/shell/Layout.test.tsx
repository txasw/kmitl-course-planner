import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { Layout, DRAWER_ID } from './Layout';
import { uiStore } from './uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';

const deps = fakeSearchDeps();

function wrapper({ children }: { children: ReactNode }) {
  return <SearchDepsProvider value={deps}>{children}</SearchDepsProvider>;
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setSheetOpen(false);
    uiStore.getState().setLanguage('th');
    uiStore.getState().setViewMode('edit');
  });
});

describe('Layout', () => {
  it('renders the search rail, the catalog, and the grid regions', () => {
    render(<Layout />, { wrapper });
    // The search rail carries the tab bar rather than a placeholder.
    expect(
      screen.getByRole('button', { name: 'หลักสูตรและชั้นปี' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    // The catalog idle state is visible; the sheet copy is aria-hidden while
    // closed, so only one is in the accessibility tree.
    expect(
      screen.getByRole('heading', { name: 'ยังไม่มีรายวิชา' }),
    ).toBeInTheDocument();
  });

  it('keeps the catalog sheet hidden until it is opened', () => {
    const { container } = render(<Layout />, { wrapper });
    const sheet = container.querySelector(`#${DRAWER_ID}`);
    expect(sheet).toHaveAttribute('aria-hidden', 'true');

    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    expect(sheet).toHaveAttribute('aria-hidden', 'false');
    expect(
      screen.getByRole('button', { name: 'ปิดรายการรายวิชา' }),
    ).toBeInTheDocument();
  });

  it('closes the sheet from its scrim', () => {
    render(<Layout />, { wrapper });
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'ปิดรายการรายวิชา' }));
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it('collapses the search rail and catalog in preview mode', () => {
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    render(<Layout />, { wrapper });
    expect(
      screen.queryByRole('button', { name: 'หลักสูตรและชั้นปี' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
  });
});
