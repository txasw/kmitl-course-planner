import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { Header } from './Header';
import { Layout } from './Layout';
import { uiStore } from './uiStore';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';

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
  resetPlanStore();
  act(() => {
    uiStore.setState({ mobilePane: null, planView: 'timetable' });
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

  it('moves focus from the header toggle to the catalog nav item below 640 px', () => {
    const viewport = installViewport(768);
    openPanel();
    render(<Panel />);
    screen.getByRole('button', { name: 'รายวิชา' }).focus();

    act(() => {
      viewport.resize(390);
    });
    const item = screen.getByRole('button', { name: 'รายวิชา' });
    expect(item.closest('nav')).not.toBeNull();
    expect(item).toHaveFocus();
  });

  it('moves focus out of the docked column to the nav item of the timetable pane', () => {
    seedActivePlan([makePlanEntry()]);
    const viewport = installViewport(1440);
    openPanel();
    render(<Panel />);
    const semester = screen.getByRole('combobox', { name: 'ภาคการศึกษา' });
    semester.focus();

    act(() => {
      viewport.resize(390);
    });
    expect(semester.closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'ตารางเรียน' })).toHaveFocus();
  });

  it('moves focus from a nav item to the header toggle when the sheet tier returns', () => {
    const viewport = installViewport(390);
    openPanel();
    render(<Panel />);
    screen.getByRole('button', { name: 'ตารางเรียน' }).focus();

    act(() => {
      viewport.resize(768);
    });
    const toggle = screen.getByRole('button', { name: 'รายวิชา' });
    expect(toggle.closest('header')).not.toBeNull();
    expect(toggle).toHaveFocus();
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
