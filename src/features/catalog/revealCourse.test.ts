import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  EMPTY_DISCLOSURE,
  catalogQueryKey,
  isCardOpen,
} from '@/lib/catalog/cardDisclosure';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { dragStore } from '@/features/planner/dragStore';
import { SEARCH_BAR_ID } from '@/features/search/searchIds';
import { searchStore, selectFormOpen } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { catalogStore } from './catalogStore';
import { courseToggleId } from './courseFocus';
import { revealCourse, searchForCourse } from './revealCourse';

const QUERY: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  search_all_faculty: false,
  selected_subject_owner_id: '32',
};

const SUBJECT = '90592033';

// A strip action to reveal from, and a card toggle and a summary bar to land on, laid
// out the way the catalog renders them.
let control: HTMLButtonElement;
let toggle: HTMLButtonElement;
let bar: HTMLDivElement;

beforeEach(() => {
  control = document.createElement('button');
  const card = document.createElement('article');
  card.dataset.courseCard = SUBJECT;
  toggle = document.createElement('button');
  toggle.id = courseToggleId(SUBJECT);
  card.append(toggle);
  bar = document.createElement('div');
  bar.id = SEARCH_BAR_ID;
  bar.tabIndex = -1;
  document.body.append(control, card, bar);
  control.focus();
});

afterEach(() => {
  document.body.replaceChildren();
  catalogStore.getState().resetFilter();
  catalogStore.setState({ disclosure: EMPTY_DISCLOSURE });
  searchStore.setState({
    resultQuery: null,
    barQuery: null,
    searchFormOpen: false,
  });
  searchStore.getState().setActiveTab('by_class');
  searchStore.getState().patchSubjectIdForm({ subjectId: '' });
  dragStore.setState({ blockMove: null });
  resetPlanStore();
  uiStore.getState().setSheetOpen(false);
  uiStore.getState().setCatalogVisible(true);
  uiStore.setState({ mobilePane: null });
});

describe('revealCourse', () => {
  it('narrows the list to the subject id', () => {
    revealCourse(control, SUBJECT, 'xl');
    expect(catalogStore.getState().filter.text).toBe(SUBJECT);
  });

  it('shows the hidden docked column and focuses the course', () => {
    uiStore.getState().setCatalogVisible(false);
    expect(revealCourse(control, SUBJECT, 'lg')).toBe(true);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it('focuses the course in a docked column already shown', () => {
    revealCourse(control, SUBJECT, 'xl');
    expect(toggle).toHaveFocus();
  });

  it('opens the sheet on the medium tier and focuses the course', () => {
    revealCourse(control, SUBJECT, 'medium');
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(toggle).toHaveFocus();
  });

  it('shows the catalog pane below 640 px and opens no sheet', () => {
    uiStore.getState().setMobilePane('plan');
    revealCourse(control, SUBJECT, 'compact');
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(toggle).toHaveFocus();
  });

  it('folds an open search form below 640 px so the results show', () => {
    searchStore.setState({ barQuery: QUERY, searchFormOpen: true });
    revealCourse(control, SUBJECT, 'compact');
    expect(selectFormOpen(searchStore.getState())).toBe(false);
  });

  it('leaves an open search form alone from 640 px up', () => {
    searchStore.setState({ barQuery: QUERY, searchFormOpen: true });
    revealCourse(control, SUBJECT, 'medium');
    expect(selectFormOpen(searchStore.getState())).toBe(true);
  });

  it('opens the card even after the student closed it', () => {
    searchStore.setState({ resultQuery: QUERY });
    const key = catalogQueryKey(QUERY);
    catalogStore
      .getState()
      .setCardOpen(key, SUBJECT, { open: false, added: false });
    revealCourse(control, SUBJECT, 'xl');
    const { disclosure } = catalogStore.getState();
    expect(isCardOpen(disclosure, key, SUBJECT, false, false)).toBe(true);
  });

  it('opens the card of a course already in the plan', () => {
    searchStore.setState({ resultQuery: QUERY });
    seedActivePlan([
      makePlanEntry({ snapshot: makeSnapshot({ subjectId: SUBJECT }) }),
    ]);
    revealCourse(control, SUBJECT, 'xl');
    const { disclosure } = catalogStore.getState();
    const key = catalogQueryKey(QUERY);
    expect(isCardOpen(disclosure, key, SUBJECT, true, false)).toBe(true);
  });

  it('does nothing during a block move', () => {
    uiStore.getState().setCatalogVisible(false);
    const section = makeSection({ subjectId: SUBJECT });
    dragStore.getState().startBlockMove(section, [section], null);
    expect(revealCourse(control, SUBJECT, 'lg')).toBe(false);
    expect(uiStore.getState().catalogVisible).toBe(false);
    expect(catalogStore.getState().filter.text).toBe('');
    expect(control).toHaveFocus();
  });
});

describe('searchForCourse', () => {
  it('runs a by subject id search in the plan term and focuses the bar', () => {
    seedActivePlan([], { year: '2569', semester: '2' });
    const submit = vi.fn(() => Promise.resolve());
    expect(searchForCourse(control, SUBJECT, 'medium', submit)).toBe(true);
    const search = searchStore.getState();
    expect(search.activeTab).toBe('by_subject_id');
    expect(search.bySubjectId.subjectId).toBe(SUBJECT);
    expect(search.term).toEqual({ year: '2569', semester: '2' });
    expect(catalogStore.getState().filter.text).toBe(SUBJECT);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(bar).toHaveFocus();
  });

  it('shows the hidden docked column before it searches', () => {
    uiStore.getState().setCatalogVisible(false);
    searchForCourse(control, SUBJECT, 'xl', () => Promise.resolve());
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(bar).toHaveFocus();
  });

  it('does nothing during a block move', () => {
    const section = makeSection({ subjectId: SUBJECT });
    dragStore.getState().startBlockMove(section, [section], null);
    const submit = vi.fn(() => Promise.resolve());
    expect(searchForCourse(control, SUBJECT, 'medium', submit)).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    expect(uiStore.getState().sheetOpen).toBe(false);
  });
});
