import { afterEach, describe, expect, it } from 'vitest';
import type { HostObservation } from '@/lib/regis/hostObservation';
import { INITIAL_HEALTH } from '@/lib/regis/observerHealth';
import { hostStore } from './hostStore';

const OPEN = { surrogate: false, testedBuild: true };

function observation(patch: Partial<HostObservation>): HostObservation {
  return {
    step: 2,
    term: null,
    card: null,
    list: [],
    credits: null,
    dialog: null,
    toasts: [],
    results: null,
    ...patch,
  };
}

const GRADE_DIALOG = observation({
  card: {
    status: 'offered',
    subjectId: '01476106',
    colour: 'pending',
    primary: null,
    practice: null,
  },
  dialog: { kind: 'gradeNotAnnounced', prerequisites: ['01476105'] },
});

afterEach(() => {
  hostStore.setState({ health: INITIAL_HEALTH, page: null, conditional: {} });
});

describe('hostStore', () => {
  it('keeps the conditional ids after the dialog closes', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: GRADE_DIALOG });
    record(OPEN, { reading: 'ok', observation: observation({}) });
    expect(hostStore.getState().page?.conditional).toEqual({
      '01476106': ['01476105'],
    });
  });

  it('drops the page on drift and on an untested build', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({}) });
    record(OPEN, { reading: 'drift' });
    expect(hostStore.getState()).toMatchObject({
      page: null,
      health: { status: 'degraded' },
    });
    record(
      { surrogate: false, testedBuild: false },
      { reading: 'ok', observation: observation({}) },
    );
    expect(hostStore.getState()).toMatchObject({
      page: null,
      health: { status: 'off', reason: 'untestedBuild' },
    });
  });

  it('forgets the page on leaving but keeps an off state', () => {
    const { record, leave } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({}) });
    leave();
    expect(hostStore.getState()).toMatchObject({
      page: null,
      health: INITIAL_HEALTH,
    });
    record({ surrogate: true, testedBuild: true }, { reading: 'absent' });
    leave();
    expect(hostStore.getState().health).toEqual({
      status: 'off',
      reason: 'surrogate',
    });
  });
});
