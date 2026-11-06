import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { Header } from './Header';
import { Layout } from './Layout';
import { uiStore } from './uiStore';

// The header and the panel body together, as the overlay renders them, so the header
// sheet toggle and the docked controls can trade places on a tier change.
function Panel() {
  return (
    <SearchDepsProvider value={fakeSearchDeps()}>
      <Header titleId="title" />
      <Layout />
    </SearchDepsProvider>
  );
}

function openPanel(): void {
  act(() => {
    uiStore.getState().open();
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setCatalogVisible(true);
  });
});

describe('useCatalogFocusRepair', () => {
  it('moves focus from the rail to the header toggle when the dock gives way to the sheet', () => {
    const viewport = installViewport(1440);
    openPanel();
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<Panel />);
    screen.getByRole('button', { name: 'แสดงรายวิชา' }).focus();

    act(() => {
      viewport.resize(768);
    });
    expect(screen.getByRole('button', { name: 'รายวิชา' })).toHaveFocus();
  });

  it('moves focus from the header toggle to the rail when the column docks hidden', () => {
    const viewport = installViewport(768);
    openPanel();
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<Panel />);
    screen.getByRole('button', { name: 'รายวิชา' }).focus();

    act(() => {
      viewport.resize(1440);
    });
    expect(screen.getByRole('button', { name: 'แสดงรายวิชา' })).toHaveFocus();
  });

  it('moves focus from the header toggle to the hide control when the column docks shown', () => {
    const viewport = installViewport(768);
    openPanel();
    render(<Panel />);
    screen.getByRole('button', { name: 'รายวิชา' }).focus();

    act(() => {
      viewport.resize(1024);
    });
    expect(screen.getByRole('button', { name: 'ซ่อนรายวิชา' })).toHaveFocus();
  });

  it('moves focus out of the docked column when it gives way to the closed sheet', () => {
    const viewport = installViewport(1440);
    openPanel();
    render(<Panel />);
    const semester = screen.getByRole('combobox', { name: 'ภาคการศึกษา' });
    semester.focus();

    act(() => {
      viewport.resize(768);
    });
    expect(semester.closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'รายวิชา' })).toHaveFocus();
  });

  it('leaves focus on another live element alone', () => {
    const viewport = installViewport(1440);
    openPanel();
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<Panel />);
    const close = screen.getByRole('button', { name: 'ปิด' });
    close.focus();

    act(() => {
      viewport.resize(768);
    });
    expect(close).toHaveFocus();
  });

  it('does nothing while the overlay is closed', () => {
    const viewport = installViewport(1440);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<Panel />);
    screen.getByRole('button', { name: 'แสดงรายวิชา' }).focus();

    act(() => {
      viewport.resize(768);
    });
    expect(screen.getByRole('button', { name: 'รายวิชา' })).not.toHaveFocus();
  });
});
