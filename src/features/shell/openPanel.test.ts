import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { tierForWidth, type LayoutTier } from '@/lib/ui/breakpoints';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { installViewport } from '../../../tests/support/viewport';
import { currentLayoutTier, openPanelAt } from './openPanel';
import { uiStore, type UiState } from './uiStore';

type LayoutFields = Pick<
  UiState,
  | 'isOpen'
  | 'viewMode'
  | 'mobilePane'
  | 'planView'
  | 'sheetOpen'
  | 'catalogVisible'
>;

function layout(): LayoutFields {
  const { isOpen, viewMode, mobilePane, planView, sheetOpen, catalogVisible } =
    uiStore.getState();
  return { isOpen, viewMode, mobilePane, planView, sheetOpen, catalogVisible };
}

// A session layout away from every default, so a target that writes a field shows it
// and a target that keeps one shows that too.
const AWAY: Omit<LayoutFields, 'isOpen'> = {
  viewMode: 'preview',
  mobilePane: 'plan',
  planView: 'selected',
  sheetOpen: false,
  catalogVisible: false,
};

beforeEach(() => {
  uiStore.setState({ isOpen: false, ...AWAY });
  revalidationStore.getState().setUpdatesOpen(false);
  resetPlanStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openPanelAt', () => {
  it.each(['compact', 'medium', 'xl'] as const)(
    'resume at %s opens and keeps the session layout',
    (tier) => {
      openPanelAt('resume', tier);
      expect(layout()).toEqual({ ...AWAY, isOpen: true });
    },
  );

  it.each<[LayoutTier, Partial<LayoutFields>]>([
    ['compact', { mobilePane: 'catalog' }],
    ['medium', { sheetOpen: true, catalogVisible: true }],
    ['xl', { catalogVisible: true }],
  ])('catalog at %s shows the catalog in edit mode', (tier, patch) => {
    openPanelAt('catalog', tier);
    expect(layout()).toEqual({
      ...AWAY,
      ...patch,
      viewMode: 'edit',
      isOpen: true,
    });
  });

  it('catalog switches out of preview before revealing the catalog', () => {
    const modes: string[] = [];
    const unsubscribe = uiStore.subscribe((state) => {
      modes.push(
        `${state.viewMode}:${String(state.catalogVisible)}:${String(state.isOpen)}`,
      );
    });
    openPanelAt('catalog', 'xl');
    unsubscribe();
    expect(modes).toEqual([
      'edit:false:false',
      'edit:true:false',
      'edit:true:true',
    ]);
  });

  it.each<[LayoutTier, Partial<LayoutFields>]>([
    ['compact', { mobilePane: 'plan', planView: 'timetable' }],
    ['medium', { planView: 'timetable', sheetOpen: false }],
    ['xl', { planView: 'timetable' }],
  ])('timetable at %s shows the weekly grid', (tier, patch) => {
    uiStore.setState({ mobilePane: 'catalog', sheetOpen: true });
    openPanelAt('timetable', tier);
    expect(layout()).toEqual({
      ...AWAY,
      mobilePane: 'catalog',
      sheetOpen: true,
      ...patch,
      isOpen: true,
    });
  });

  it('timetable keeps the view mode', () => {
    openPanelAt('timetable', 'xl');
    expect(uiStore.getState().viewMode).toBe('preview');
  });

  it.each<[LayoutTier, Partial<LayoutFields>]>([
    ['compact', { mobilePane: 'plan', planView: 'timetable' }],
    ['medium', { planView: 'timetable', sheetOpen: false }],
    ['xl', { planView: 'timetable' }],
  ])('updates at %s opens the dialog over the timetable', (tier, patch) => {
    seedActivePlan([makePlanEntry({ verifyStatus: 'missing' })]);
    uiStore.setState({ mobilePane: 'catalog', sheetOpen: true });
    openPanelAt('updates', tier);
    expect(layout()).toEqual({
      ...AWAY,
      mobilePane: 'catalog',
      sheetOpen: true,
      ...patch,
      viewMode: 'edit',
      isOpen: true,
    });
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });

  it('updates with no update items opens the timetable in edit and leaves the dialog shut', () => {
    seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    openPanelAt('updates', 'compact');
    expect(layout()).toEqual({
      ...AWAY,
      mobilePane: 'plan',
      planView: 'timetable',
      viewMode: 'edit',
      isOpen: true,
    });
    expect(revalidationStore.getState().updatesOpen).toBe(false);
  });

  it('reads the current tier when none is given', () => {
    installViewport(390);
    openPanelAt('catalog');
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(uiStore.getState().sheetOpen).toBe(false);
  });
});

describe('currentLayoutTier', () => {
  it.each([390, 768, 1024, 1366, 1600])(
    'agrees with tierForWidth at %i px',
    (width) => {
      installViewport(width);
      expect(currentLayoutTier()).toBe(tierForWidth(width));
    },
  );
});
