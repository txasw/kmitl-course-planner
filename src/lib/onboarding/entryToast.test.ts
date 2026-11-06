import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanEntry } from '../domain/plan';
import {
  makePlan,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { countUpdateItems, hasUpdateItems } from '../planner/updateReview';
import {
  ENTRY_TOAST_DELAY_MS,
  ENTRY_TOAST_NAME_MAX,
  ENTRY_TOAST_VISIBLE_MS,
  clampEntryToastName,
  selectEntryToast,
  type EntryToastInput,
} from './entryToast';

function placed(id: string, subjectId: string, section: string): PlanEntry {
  return makePlanEntry({
    snapshot: makeSnapshot({ teachTableId: id, subjectId, section }),
    verifyStatus: 'verified',
  });
}

function withReview(entry: PlanEntry): PlanEntry {
  return {
    ...entry,
    verifyStatus: 'changed',
    review: {
      kinds: ['room_changed'],
      before: entry.snapshot,
      detectedAt: '2026-11-06T00:00:00.000Z',
      notifiedAt: null,
    },
  };
}

function input(overrides: Partial<EntryToastInput> = {}): EntryToastInput {
  return {
    plan: makePlan({ name: 'ตาราง 1/2569', entries: [] }),
    onboarding: {},
    isOpen: false,
    welcomeOpen: false,
    documentSuppressed: false,
    settled: true,
    ...overrides,
  };
}

function graphemeCount(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text)).length;
}

describe('entry toast timing', () => {
  it('waits two seconds and stays for eight', () => {
    expect(ENTRY_TOAST_DELAY_MS).toBe(2000);
    expect(ENTRY_TOAST_VISIBLE_MS).toBe(8000);
    expect(ENTRY_TOAST_NAME_MAX).toBe(40);
  });
});

describe('selectEntryToast gating', () => {
  it.each<[string, Partial<EntryToastInput>]>([
    ['not settled', { settled: false }],
    [
      'opted out',
      { onboarding: { entryToastOptOutAt: '2026-11-06T00:00:00Z' } },
    ],
    ['the panel is open', { isOpen: true }],
    ['the welcome is open', { welcomeOpen: true }],
    ['the document is suppressed', { documentSuppressed: true }],
  ])('shows nothing when %s', (_label, overrides) => {
    expect(selectEntryToast(input(overrides))).toBeNull();
    expect(selectEntryToast(input({ ...overrides, plan: null }))).toBeNull();
  });

  it('shows once every gate is clear and no opt out is recorded', () => {
    expect(
      selectEntryToast(
        input({ onboarding: { entryToastOptOutAt: undefined } }),
      ),
    ).not.toBeNull();
  });
});

describe('selectEntryToast content', () => {
  it('offers the catalog when there is no plan', () => {
    expect(selectEntryToast(input({ plan: null }))).toEqual({
      kind: 'noPlan',
      messageKey: 'entryToast.noPlan',
      actionKey: 'entryToast.noPlan.action',
      params: {},
      target: 'catalog',
    });
  });

  it('offers the catalog for an empty plan', () => {
    expect(selectEntryToast(input())).toEqual({
      kind: 'planEmpty',
      messageKey: 'entryToast.planEmpty',
      actionKey: 'entryToast.planEmpty.action',
      params: { name: 'ตาราง 1/2569' },
      target: 'catalog',
    });
  });

  it('opens the timetable for a plan with subjects, counting a pair once', () => {
    const entries = [
      placed('1', '90592033', '901'),
      placed('2', '90592033', '902'),
      placed('3', '01006001', '1'),
    ];
    expect(
      selectEntryToast(input({ plan: makePlan({ name: 'Plan A', entries }) })),
    ).toEqual({
      kind: 'plan',
      messageKey: 'entryToast.plan',
      actionKey: 'entryToast.plan.action',
      params: { name: 'Plan A', count: 2 },
      target: 'timetable',
    });
  });

  it('puts open reviews and missing entries ahead of the plan', () => {
    const entries = [
      withReview(placed('1', '90592033', '901')),
      placed('2', '01006001', '1'),
      { ...placed('3', '01006002', '1'), verifyStatus: 'missing' as const },
    ];
    expect(
      selectEntryToast(input({ plan: makePlan({ name: 'Plan A', entries }) })),
    ).toEqual({
      kind: 'updates',
      messageKey: 'entryToast.updates',
      actionKey: 'entryToast.updates.action',
      params: { name: 'Plan A', count: countUpdateItems(entries) },
      target: 'updates',
    });
    expect(countUpdateItems(entries)).toBe(2);
  });

  it('takes the updates kind exactly when the updates dialog has items', () => {
    const cases: PlanEntry[][] = [
      [placed('1', '90592033', '901')],
      [withReview(placed('1', '90592033', '901'))],
      [{ ...placed('1', '90592033', '901'), verifyStatus: 'missing' }],
      [{ ...placed('1', '90592033', '901'), verifyStatus: 'changed' }],
    ];
    for (const entries of cases) {
      const toast = selectEntryToast(input({ plan: makePlan({ entries }) }));
      expect(toast?.kind === 'updates').toBe(hasUpdateItems(entries));
    }
  });

  it('states the clamped plan name', () => {
    const toast = selectEntryToast(
      input({ plan: makePlan({ name: 'ก'.repeat(60) }) }),
    );
    expect(toast?.params).toMatchObject({
      name: clampEntryToastName('ก'.repeat(60)),
    });
  });
});

describe('clampEntryToastName', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a name within the limit as written', () => {
    expect(clampEntryToastName('ตาราง 1/2569')).toBe('ตาราง 1/2569');
    expect(clampEntryToastName('a'.repeat(40))).toBe('a'.repeat(40));
  });

  it('clamps a 60 character name to 40 with a marker', () => {
    const clamped = clampEntryToastName('a'.repeat(60));
    expect(clamped).toBe(`${'a'.repeat(37)}...`);
    expect(graphemeCount(clamped)).toBe(ENTRY_TOAST_NAME_MAX);
  });

  it('counts a Thai consonant with its marks as one grapheme', () => {
    const syllable = 'ที่';
    expect(clampEntryToastName(syllable.repeat(20))).toBe(syllable.repeat(20));
    expect(clampEntryToastName(syllable.repeat(60))).toBe(
      `${syllable.repeat(37)}...`,
    );
  });

  it('never ends on half of a surrogate pair', () => {
    const wide = '\u{20000}';
    expect(clampEntryToastName(wide.repeat(60))).toBe(`${wide.repeat(37)}...`);
  });

  it('trims a space left before the marker', () => {
    expect(clampEntryToastName(`${'a'.repeat(36)} ${'b'.repeat(23)}`)).toBe(
      `${'a'.repeat(36)}...`,
    );
  });

  it('falls back to code points with marks kept on their base', () => {
    // Object.create returns any; the stub only needs to be an object whose Segmenter
    // is missing while every other Intl member is inherited.
    vi.stubGlobal(
      'Intl',
      Object.assign(Object.create(Intl) as object, { Segmenter: undefined }),
    );
    expect(clampEntryToastName('')).toBe('');
    const syllable = 'ที่';
    expect(clampEntryToastName(syllable.repeat(60))).toBe(
      `${syllable.repeat(37)}...`,
    );
    const wide = '\u{20000}';
    expect(clampEntryToastName(wide.repeat(60))).toBe(`${wide.repeat(37)}...`);
    expect(clampEntryToastName('a'.repeat(60))).toBe(`${'a'.repeat(37)}...`);
  });
});
