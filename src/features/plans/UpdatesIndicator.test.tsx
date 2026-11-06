import { describe, it, expect, afterEach } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { PlanEntry, ReviewKind } from '@/lib/domain/plan';
import { uiStore } from '@/features/shell/uiStore';
import {
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { planStore } from './planStore';
import { revalidationStore } from './revalidationStore';
import { UpdatesIndicator } from './UpdatesIndicator';

afterEach(() => {
  cleanup();
  resetPlanStore();
  act(() => {
    revalidationStore.getState().setUpdatesOpen(false);
    uiStore.getState().setLanguage('th');
  });
});

function reviewed(id: string, kinds: ReviewKind[]): PlanEntry {
  const snapshot = makeSnapshot({
    teachTableId: id,
    subjectId: `9000000${id}`,
  });
  return makePlanEntry({
    snapshot,
    verifyStatus: 'changed',
    review: {
      kinds,
      before: snapshot,
      detectedAt: '2026-11-06T00:00:00.000Z',
      notifiedAt: null,
    },
  });
}

describe('UpdatesIndicator', () => {
  it('renders nothing while the plan has nothing to review', () => {
    seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    const { container } = render(<UpdatesIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the count of items the updates dialog lists', () => {
    seedActivePlan([
      reviewed('1', ['room_changed']),
      makePlanEntry({ verifyStatus: 'missing' }),
      makePlanEntry({ verifyStatus: 'verified' }),
    ]);
    render(<UpdatesIndicator />);
    expect(
      screen.getByRole('button', { name: 'มีการเปลี่ยนแปลง 2 รายการ' }),
    ).toBeVisible();
  });

  it('reads in English when the panel language is English', () => {
    seedActivePlan([reviewed('1', ['time_changed'])]);
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<UpdatesIndicator />);
    expect(
      screen.getByRole('button', { name: 'Changes to review: 1' }),
    ).toBeVisible();
  });

  it('reopens the updates dialog', () => {
    seedActivePlan([reviewed('1', ['room_changed'])]);
    render(<UpdatesIndicator />);
    fireEvent.click(
      screen.getByRole('button', { name: 'มีการเปลี่ยนแปลง 1 รายการ' }),
    );
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });

  it('leaves once every item is acknowledged', () => {
    seedActivePlan([reviewed('1', ['room_changed'])]);
    const { container } = render(<UpdatesIndicator />);
    act(() => {
      planStore.getState().acknowledge('1');
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('stays for a section no longer listed until it is removed', () => {
    const missing = reviewed('1', ['missing']);
    seedActivePlan([{ ...missing, verifyStatus: 'missing' }]);
    render(<UpdatesIndicator />);
    act(() => {
      planStore.getState().acknowledge('1');
    });
    expect(
      screen.getByRole('button', { name: 'มีการเปลี่ยนแปลง 1 รายการ' }),
    ).toBeVisible();
  });
});
