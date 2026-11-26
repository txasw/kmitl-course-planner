import { afterEach, describe, expect, it } from 'vitest';
import type { HostObservation } from '@/lib/regis/hostObservation';
import { INITIAL_HEALTH } from '@/lib/regis/observerHealth';
import { hostStore } from './hostStore';

const OPEN = { surrogate: false, build: 'tested' as const };

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
    practiceSelect: false,
    seats: null,
  },
  dialog: { kind: 'gradeNotAnnounced', prerequisites: ['01476105'] },
});

afterEach(() => {
  hostStore.setState({
    health: INITIAL_HEALTH,
    page: null,
    term: null,
    lastTerm: null,
    termWaitOver: false,
    termWaitDue: false,
    conditional: {},
  });
});

const TERM = { year: '2569', semester: '2' } as const;

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
      { surrogate: false, build: 'untested' as const },
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
    record(
      { surrogate: true, build: 'tested' as const },
      { reading: 'absent' },
    );
    leave();
    expect(hostStore.getState().health).toEqual({
      status: 'off',
      reason: 'surrogate',
    });
  });

  it('keeps the term the header showed through a drift and a restart', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({ term: TERM }) });
    record(OPEN, { reading: 'drift' });
    expect(hostStore.getState()).toMatchObject({ page: null, term: TERM });
    record(OPEN, { reading: 'ok', observation: observation({ term: null }) });
    expect(hostStore.getState().term).toEqual(TERM);
    hostStore.getState().restart();
    expect(hostStore.getState()).toMatchObject({
      page: null,
      term: TERM,
      health: INITIAL_HEALTH,
    });
  });

  it('forgets the term on leaving the page and in a staff session', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({ term: TERM }) });
    hostStore.getState().leave();
    expect(hostStore.getState().term).toBeNull();
    record(OPEN, { reading: 'ok', observation: observation({ term: TERM }) });
    record(
      { surrogate: true, build: 'tested' as const },
      { reading: 'absent' },
    );
    expect(hostStore.getState().term).toBeNull();
  });

  it('keeps waiting for the term while the page shows no panel', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'absent' });
    hostStore.getState().dueTermWait();
    expect(hostStore.getState().termWaitOver).toBe(false);
    record(OPEN, { reading: 'absent' });
    expect(hostStore.getState().termWaitOver).toBe(false);
    // The panel shows with no term in its header: the term is not coming.
    record(OPEN, { reading: 'ok', observation: observation({}) });
    expect(hostStore.getState().termWaitOver).toBe(true);
  });

  it('ends the wait at once when the panel already showed with no term', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({}) });
    expect(hostStore.getState().termWaitOver).toBe(false);
    hostStore.getState().dueTermWait();
    expect(hostStore.getState().termWaitOver).toBe(true);
  });

  it('never ends the wait for a panel read before the usual wait passed', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({}) });
    record(OPEN, { reading: 'ok', observation: observation({}) });
    expect(hostStore.getState().termWaitOver).toBe(false);
  });

  it('keeps the last read term as a hint after leaving the page', () => {
    const { record } = hostStore.getState();
    record(OPEN, { reading: 'ok', observation: observation({ term: TERM }) });
    hostStore.getState().endTermWait();
    hostStore.getState().leave();
    const state = hostStore.getState();
    expect(state.term).toBeNull();
    expect(state.termWaitOver).toBe(false);
    expect(state.termWaitDue).toBe(false);
    expect(state.lastTerm).toEqual(TERM);
  });
});
