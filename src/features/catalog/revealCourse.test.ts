import { describe, it, expect, afterEach } from 'vitest';
import {
  EMPTY_DISCLOSURE,
  catalogQueryKey,
  isCardOpen,
} from '@/lib/catalog/cardDisclosure';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { searchStore } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import {
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { catalogStore } from './catalogStore';
import { revealCourse } from './revealCourse';

const QUERY: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  search_all_faculty: false,
  selected_subject_owner_id: '32',
};

afterEach(() => {
  catalogStore.getState().resetFilter();
  catalogStore.setState({ disclosure: EMPTY_DISCLOSURE });
  searchStore.setState({ resultQuery: null });
  resetPlanStore();
  uiStore.getState().setSheetOpen(false);
  uiStore.getState().setCatalogVisible(true);
  uiStore.setState({ mobilePane: null });
});

describe('revealCourse', () => {
  it('narrows the list to the subject id', () => {
    revealCourse('90592033', 'xl');
    expect(catalogStore.getState().filter.text).toBe('90592033');
  });

  it('shows the docked column on a docked tier', () => {
    uiStore.getState().setCatalogVisible(false);
    revealCourse('90592033', 'lg');
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it('opens the sheet on the medium tier', () => {
    revealCourse('90592033', 'medium');
    expect(uiStore.getState().sheetOpen).toBe(true);
  });

  it('shows the catalog pane below 640 px and opens no sheet', () => {
    uiStore.getState().setMobilePane('plan');
    revealCourse('90592033', 'compact');
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it('opens the card even after the student closed it', () => {
    searchStore.setState({ resultQuery: QUERY });
    const key = catalogQueryKey(QUERY);
    catalogStore
      .getState()
      .setCardOpen(key, '90592033', { open: false, added: false });
    revealCourse('90592033', 'xl');
    const { disclosure } = catalogStore.getState();
    expect(isCardOpen(disclosure, key, '90592033', false, false)).toBe(true);
  });

  it('opens the card of a course already in the plan', () => {
    searchStore.setState({ resultQuery: QUERY });
    seedActivePlan([
      makePlanEntry({ snapshot: makeSnapshot({ subjectId: '90592033' }) }),
    ]);
    revealCourse('90592033', 'xl');
    const { disclosure } = catalogStore.getState();
    const key = catalogQueryKey(QUERY);
    expect(isCardOpen(disclosure, key, '90592033', true, false)).toBe(true);
  });
});
