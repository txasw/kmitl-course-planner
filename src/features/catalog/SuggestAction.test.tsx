import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { searchStore } from '@/features/search/searchStore';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { installViewport } from '../../../tests/support/viewport';
import { SuggestAction } from './SuggestAction';

const BY_CLASS: TeachTableQuery = {
  mode: 'by_class',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  selected_department: '05',
  selected_curriculum: '137',
  selected_class_year: '1',
  search_all_faculty: false,
  search_all_department: false,
  search_all_curriculum: false,
  search_all_class_year: false,
};

const BY_SUBJECT_ID: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_subject_id: '01006020',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
};

const BY_OWNER: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  search_all_faculty: false,
  selected_subject_owner_id: '32',
};

function byClassCatalog() {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_class.capture.json'),
  );
  if (!result.ok) throw new Error('by_class capture failed to normalize');
  return result.value;
}

function showResult(query: TeachTableQuery) {
  act(() => {
    searchStore
      .getState()
      .setResult({ status: 'ready', data: byClassCatalog() }, query);
  });
}

function renderAction() {
  const portal = document.createElement('div');
  document.body.append(portal);
  render(
    <PanelPortalContext.Provider value={portal}>
      <SuggestAction />
    </PanelPortalContext.Provider>,
  );
}

const openButton = () => screen.queryByRole('button', { name: 'แนะนำตาราง' });

beforeEach(() => {
  installViewport(1366);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    searchStore.getState().setResult({ status: 'idle' }, null);
    resetPlanStore();
  });
});

describe('SuggestAction', () => {
  it('opens the suggestion dialog from a curriculum result', () => {
    showResult(BY_CLASS);
    renderAction();
    const button = openButton();
    if (button === null) throw new Error('no suggest action');
    fireEvent.click(button);
    expect(
      screen.getByRole('dialog', { name: 'แนะนำตาราง' }),
    ).toBeInTheDocument();
  });

  it('shows for the active plan of the same term', () => {
    act(() => {
      seedActivePlan([], { year: '2569', semester: '1' });
    });
    showResult(BY_CLASS);
    renderAction();
    expect(openButton()).not.toBeNull();
  });

  it('is absent for a subject id or category result', () => {
    showResult(BY_SUBJECT_ID);
    renderAction();
    expect(openButton()).toBeNull();
    showResult(BY_OWNER);
    expect(openButton()).toBeNull();
  });

  it('is absent when the active plan belongs to another term', () => {
    act(() => {
      seedActivePlan([], { year: '2569', semester: '2' });
    });
    showResult(BY_CLASS);
    renderAction();
    expect(openButton()).toBeNull();
  });

  it('is absent for a curriculum result with no group 2 course', () => {
    const catalog = byClassCatalog();
    act(() => {
      searchStore.getState().setResult(
        {
          status: 'ready',
          data: {
            ...catalog,
            courses: catalog.courses.filter((course) =>
              course.groupNameTh.startsWith('กลุ่ม 1'),
            ),
          },
        },
        BY_CLASS,
      );
    });
    renderAction();
    expect(openButton()).toBeNull();
  });
});
