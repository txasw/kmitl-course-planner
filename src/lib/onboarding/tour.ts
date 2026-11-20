// The first run product tour (ADR-0074) as data and pure choices: its steps, the
// controls each step can point at, and when the tour starts on its own. The tour walks
// the student through the real controls of the panel, a spotlight on one control per
// step, in the order a plan is made: search, add a section, read the timetable, ask for
// a suggestion, and export.
//
// A step names the panel view it lives in and, in order of preference, the controls it
// can point at, each with the sentence that fits that control. The search step points at
// the query chip once a search ran and at the search tabs before; the add step points at
// an add button of an open course, else at a course to open, else at the search button;
// the timetable step points at the day chips of a narrow timetable, else at the
// timetable tab, else at the bottom nav item. A step with none of its controls on the
// page is left out, so a student with no curriculum search meets no suggest step and the
// count says four.
//
// The tour starts on its own once per document when the panel is open in edit, the
// onboarding record has been read, nothing else holds the panel (the welcome, a dialog,
// a sheet, a menu), and the record names no finished or skipped tour of this version or
// later. After install that is the moment the welcome's Start planning opens the panel;
// for a student who installed before the tour existed it is the first open after the
// update. Raising TOUR_VERSION shows a revised tour once more to everyone.

import type { TranslationKey } from '@/lib/i18n/t';

/** The tour revision. A stored mark below it means the tour is due again. */
export const TOUR_VERSION = 1;

/** How long the start conditions must hold before the tour opens, in milliseconds, so it
 * never lands on a panel that is still settling its first frame or a gesture that just
 * ended. */
export const TOUR_START_DELAY_MS = 500;

/** The control a step points at, carried by the control as its data-tour attribute. */
export type TourTarget =
  | 'search-chip'
  | 'search-tabs'
  | 'add'
  | 'course'
  | 'search-submit'
  | 'day-chips'
  | 'plan-tab'
  | 'nav-timetable'
  | 'suggest'
  | 'export';

/** The selector of the controls marked with a target. */
export function tourTargetSelector(target: TourTarget): string {
  return `[data-tour="${target}"]`;
}

/** The props that mark a control as a tour target. */
export function tourTargetProps(target: TourTarget): { 'data-tour': string } {
  return { 'data-tour': target };
}

/**
 * The panel view a step lives in: the catalog with its search, the plan on its
 * timetable, or the header, which every view shows.
 */
export type TourView = 'catalog' | 'plan' | 'header';

export interface TourAnchor {
  target: TourTarget;
  /** The sentence the card shows while it points at this control. */
  body: TranslationKey;
}

export type TourStepId = 'search' | 'add' | 'timetable' | 'suggest' | 'export';

export interface TourStep {
  id: TourStepId;
  view: TourView;
  title: TranslationKey;
  /** The controls the step can point at, most fitting first. */
  anchors: readonly TourAnchor[];
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'search',
    view: 'catalog',
    title: 'tour.search.title',
    anchors: [
      { target: 'search-chip', body: 'tour.search.bodyChip' },
      { target: 'search-tabs', body: 'tour.search.body' },
    ],
  },
  {
    id: 'add',
    view: 'catalog',
    title: 'tour.add.title',
    anchors: [
      { target: 'add', body: 'tour.add.body' },
      { target: 'course', body: 'tour.add.bodyCourse' },
      { target: 'search-submit', body: 'tour.add.bodySearch' },
    ],
  },
  {
    id: 'timetable',
    view: 'plan',
    title: 'tour.timetable.title',
    anchors: [
      { target: 'day-chips', body: 'tour.timetable.bodyDays' },
      { target: 'plan-tab', body: 'tour.timetable.body' },
      { target: 'nav-timetable', body: 'tour.timetable.body' },
    ],
  },
  {
    id: 'suggest',
    view: 'plan',
    title: 'tour.suggest.title',
    anchors: [{ target: 'suggest', body: 'tour.suggest.body' }],
  },
  {
    id: 'export',
    view: 'header',
    title: 'tour.export.title',
    anchors: [{ target: 'export', body: 'tour.export.body' }],
  },
];

/** The steps with at least one of their controls on the page, in tour order. */
export function availableSteps(
  steps: readonly TourStep[],
  hasTarget: (target: TourTarget) => boolean,
): TourStep[] {
  return steps.filter((step) =>
    step.anchors.some((anchor) => hasTarget(anchor.target)),
  );
}

/** Whether a stored tour mark leaves the current tour due. */
export function tourDue(seenVersion: number | undefined): boolean {
  return seenVersion === undefined || seenVersion < TOUR_VERSION;
}

export interface TourStartInput {
  /** The onboarding record has been read. */
  loaded: boolean;
  /** The panel is open on the edit workspace, not closed or on the export page. */
  editing: boolean;
  welcomeOpen: boolean;
  /** A dialog, sheet, menu, or popover is open in the panel. */
  surfaceOpen: boolean;
  /** The version of the tour the stored mark names, if any. */
  seenVersion: number | undefined;
  /** The tour has already started in this document, on its own or from the menu. */
  startedThisDocument: boolean;
}

/** Whether the tour starts on its own now. */
export function shouldStartTour(input: TourStartInput): boolean {
  return (
    input.loaded &&
    input.editing &&
    !input.welcomeOpen &&
    !input.surfaceOpen &&
    !input.startedThisDocument &&
    tourDue(input.seenVersion)
  );
}

/**
 * The step to show after one is found missing: the same index going forward, since the
 * steps after it move up, or the one before going back, kept at the first step.
 */
export function indexAfterDrop(index: number, direction: 1 | -1): number {
  return direction === 1 ? index : Math.max(0, index - 1);
}
