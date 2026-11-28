import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { toSnapshot } from '@/lib/planner/transaction';
import { planStore } from '@/features/plans/planStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { planMenuSlotStore } from '@/features/shell/planMenuSlotStore';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { ReadinessLayer } from './ReadinessDialog';
import { regisStore } from './regisStore';

// The readiness layer fills the plan menu slot while it is mounted, so the shared plan
// menu offers Prepare for registration without importing the helper, and empties it on
// unmount, so the menu shows no item where the helper is gone.

const COURSE = makeCourse({
  subjectId: '01476107',
  sections: [makeSection({ teachTableId: 'T1', subjectId: '01476107' })],
});
const PLAN = makePlan({
  entries: [
    makePlanEntry({
      snapshot: toSnapshot(COURSE, COURSE.sections[0] ?? makeSection()),
    }),
  ],
});

// Opening the card must send nothing, so the send only counts.
let sends = 0;
const send: TypedSend = () => {
  sends += 1;
  return new Promise<never>(() => undefined);
};

function renderLayer() {
  render(
    <SearchDepsProvider
      value={{
        send,
        repo: {
          load: () => Promise.resolve(null),
          save: () => Promise.resolve(),
        },
      }}
    >
      <PanelPortalContext.Provider value={document.body}>
        <ReadinessLayer />
      </PanelPortalContext.Provider>
    </SearchDepsProvider>,
  );
}

beforeEach(() => {
  window.location.hash = '#/pre_registration';
  act(() => {
    planStore.getState().hydrate([PLAN]);
    planStore.getState().setActivePlan(PLAN.id);
  });
  regisStore.setState({
    kits: [],
    choices: [],
    run: { status: 'idle' },
    readinessOpen: false,
  });
  sends = 0;
});

afterEach(() => {
  cleanup();
  regisStore.setState({ readinessOpen: false });
  window.location.hash = '';
});

describe('the readiness layer', () => {
  it('fills the plan menu slot with the prepare card while it is mounted', () => {
    expect(planMenuSlotStore.getState().prepareRegistration).toBeNull();
    renderLayer();
    const prepare = planMenuSlotStore.getState().prepareRegistration;
    expect(prepare).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      prepare?.();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    cleanup();
    expect(planMenuSlotStore.getState().prepareRegistration).toBeNull();
    expect(sends).toBe(0);
  });
});
