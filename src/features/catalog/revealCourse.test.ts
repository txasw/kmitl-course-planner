import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  EMPTY_DISCLOSURE,
  catalogQueryKey,
  isCardOpen,
} from '@/lib/catalog/cardDisclosure';
import {
  EMPTY_GROUP_COLLAPSE,
  isGroupCollapsed,
} from '@/lib/catalog/groupCollapse';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { dragStore } from '@/features/planner/dragStore';
import { SEARCH_BAR_ID, searchTabId } from '@/features/search/searchIds';
import { searchStore, selectFormOpen } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import {
  makeCourse,
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
import { revealCourse, revealSearch, searchForCourse } from './revealCourse';

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
  catalogStore.setState({
    disclosure: EMPTY_DISCLOSURE,
    groups: EMPTY_GROUP_COLLAPSE,
  });
  searchStore.setState({
    result: { status: 'idle' },
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

  it('expands the heading the student collapsed over the course', () => {
    const course = makeCourse({ subjectId: SUBJECT, groupNameTh: 'กลุ่ม 1' });
    searchStore.setState({
      resultQuery: QUERY,
      result: {
        status: 'ready',
        data: {
          courses: [course],
          duplicateCount: 0,
          multiMeetingCount: 0,
          warnings: [],
        },
      },
    });
    const key = catalogQueryKey(QUERY);
    catalogStore.getState().setGroupCollapsed(key, 'กลุ่ม 1', true);
    revealCourse(control, SUBJECT, 'xl');
    const { groups } = catalogStore.getState();
    expect(isGroupCollapsed(groups, key, 'กลุ่ม 1')).toBe(false);
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

describe('revealSearch', () => {
  let tab: HTMLButtonElement;

  beforeEach(() => {
    tab = document.createElement('button');
    tab.id = searchTabId('by_subject_id');
    document.body.append(tab);
    searchStore.getState().setActiveTab('by_subject_id');
  });

  it('shows the catalog pane below 640 px and focuses the active search tab', () => {
    uiStore.setState({ mobilePane: 'plan' });
    revealSearch(control, 'compact');
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(tab).toHaveFocus();
  });

  it('opens the sheet on the medium tier', () => {
    revealSearch(control, 'medium');
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(tab).toHaveFocus();
  });

  it('focuses the summary bar once a search has run', () => {
    searchStore.setState({ barQuery: QUERY });
    uiStore.getState().setCatalogVisible(false);
    revealSearch(control, 'xl');
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(bar).toHaveFocus();
  });

  it('does nothing while a drag is in flight', () => {
    const section = makeSection({ subjectId: SUBJECT });
    dragStore.getState().startBlockMove(section, [section], null);
    revealSearch(control, 'medium');
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(control).toHaveFocus();
  });
});
