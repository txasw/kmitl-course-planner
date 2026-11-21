import { describe, expect, it } from 'vitest';
import th from '@/lib/i18n/th.json';
import en from '@/lib/i18n/en.json';
import {
  availableSteps,
  indexAfterDrop,
  shouldStartTour,
  tourDue,
  tourTargetProps,
  tourTargetSelector,
  TOUR_STEPS,
  TOUR_VERSION,
  type TourStartInput,
  type TourTarget,
} from './tour';

const DUE: TourStartInput = {
  loaded: true,
  editing: true,
  welcomeOpen: false,
  surfaceOpen: false,
  seenVersion: undefined,
  startedThisDocument: false,
};

describe('the product tour steps', () => {
  it('walks search, add, timetable, suggest, and export in that order', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'search',
      'add',
      'timetable',
      'suggest',
      'export',
    ]);
  });

  it('gives every step a title and every target a sentence in both languages', () => {
    for (const step of TOUR_STEPS) {
      expect(th[step.title], step.id).toEqual(expect.any(String));
      expect(en[step.title], step.id).toEqual(expect.any(String));
      for (const anchor of step.anchors) {
        expect(th[anchor.body], anchor.target).toEqual(expect.any(String));
        expect(en[anchor.body], anchor.target).toEqual(expect.any(String));
      }
    }
  });

  it('names each target once across the steps', () => {
    const targets = TOUR_STEPS.flatMap((step) =>
      step.anchors.map((anchor) => anchor.target),
    );
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('marks a control and finds it by the same attribute', () => {
    expect(tourTargetProps('export')).toEqual({ 'data-tour': 'export' });
    expect(tourTargetSelector('export')).toBe('[data-tour="export"]');
  });
});

describe('availableSteps', () => {
  it('keeps every step whose target is on the page', () => {
    expect(availableSteps(TOUR_STEPS, () => true)).toEqual(TOUR_STEPS);
  });

  it('leaves out the suggest step when no suggest action is on the page', () => {
    const present = (target: TourTarget) => target !== 'suggest';
    expect(availableSteps(TOUR_STEPS, present).map((step) => step.id)).toEqual([
      'search',
      'add',
      'timetable',
      'export',
    ]);
  });

  it('keeps a step that has only its last fallback target', () => {
    const present = (target: TourTarget) =>
      target === 'search-fields' || target === 'export';
    expect(availableSteps(TOUR_STEPS, present).map((step) => step.id)).toEqual([
      'add',
      'export',
    ]);
  });
});

describe('tourDue', () => {
  it('is due with no mark and with a mark from an earlier tour', () => {
    expect(tourDue(undefined)).toBe(true);
    expect(tourDue(TOUR_VERSION - 1)).toBe(true);
  });

  it('is not due once this tour or a later one ended', () => {
    expect(tourDue(TOUR_VERSION)).toBe(false);
    expect(tourDue(TOUR_VERSION + 1)).toBe(false);
  });
});

describe('shouldStartTour', () => {
  it('starts on an open edit panel with the record read and no tour seen', () => {
    expect(shouldStartTour(DUE)).toBe(true);
  });

  it.each([
    ['before the record is read', { loaded: false }],
    ['on a closed panel or the export page', { editing: false }],
    ['while the welcome is open', { welcomeOpen: true }],
    ['while a dialog, sheet, or menu holds the panel', { surfaceOpen: true }],
    ['once it started in this document', { startedThisDocument: true }],
    ['after this tour ended', { seenVersion: TOUR_VERSION }],
  ])('waits %s', (_label, patch: Partial<TourStartInput>) => {
    expect(shouldStartTour({ ...DUE, ...patch })).toBe(false);
  });

  it('starts again for a student whose mark names an earlier tour', () => {
    expect(shouldStartTour({ ...DUE, seenVersion: TOUR_VERSION - 1 })).toBe(
      true,
    );
  });
});

describe('indexAfterDrop', () => {
  it('stays on the index going forward, since the next step moves up', () => {
    expect(indexAfterDrop(2, 1)).toBe(2);
  });

  it('moves back one going back, and never before the first step', () => {
    expect(indexAfterDrop(2, -1)).toBe(1);
    expect(indexAfterDrop(0, -1)).toBe(0);
  });
});
