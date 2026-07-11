import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { App } from './App';
import { uiStore } from '@/features/shell/uiStore';
import type { PrefsRepository } from '@/lib/storage/prefs';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { fakePlanDeps } from '../../../tests/support/planDeps';

function noopRepo(): PrefsRepository {
  return {
    load: () => Promise.resolve(null),
    save: () => Promise.resolve(),
  };
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
});

describe('App', () => {
  it('shows the launcher and opens the overlay on activation', () => {
    render(
      <App
        prefs={noopRepo()}
        plans={fakePlanDeps()}
        search={fakeSearchDeps()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'เปิด Course Planner for KMITL' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('makes the launcher inert and hidden while the overlay is open', () => {
    render(
      <App
        prefs={noopRepo()}
        plans={fakePlanDeps()}
        search={fakeSearchDeps()}
      />,
    );
    const launcher = screen.getByRole('button', {
      name: 'เปิด Course Planner for KMITL',
    });
    act(() => {
      uiStore.getState().open();
    });
    expect(launcher).toHaveAttribute('inert');
    expect(launcher).toHaveAttribute('aria-hidden', 'true');
  });
});
