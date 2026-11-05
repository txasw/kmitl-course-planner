import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { makeCourse } from '../../../tests/support/domain-builders';
import { SearchDepsProvider } from './SearchDepsContext';
import { SearchHeader } from './SearchHeader';
import { SEARCH_FORM_ID } from './SearchSummaryBar';
import { searchStore } from './searchStore';

const term = { year: '2569', semester: '1' } as const;

const subjectQuery: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '90592033',
};

const catalog: NormalizedCatalog = {
  courses: [
    makeCourse({ subjectId: '90000001' }),
    makeCourse({ subjectId: '90000002' }),
  ],
  duplicateCount: 0,
  multiMeetingCount: 0,
  warnings: [],
};

function renderHeader() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <SearchHeader />
    </SearchDepsProvider>,
  );
}

function formRegion(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>(`#${SEARCH_FORM_ID}`);
  if (node === null) throw new Error('the search form region is not rendered');
  return node;
}

beforeEach(() => {
  const state = searchStore.getState();
  state.hydrate({
    schemaVersion: 1,
    activeTab: 'by_subject_id',
    byClass: defaultClassForm(term),
    bySubjectId: { ...defaultSubjectIdForm(term), subjectId: '90592033' },
    byCategory: defaultCategoryForm(term),
  });
  state.cancelSearch();
  state.setInitialized(false);
});

afterEach(cleanup);

describe('SearchHeader', () => {
  it('shows the open form and no bar before a search', () => {
    const { container } = renderHeader();
    expect(
      screen.queryByRole('region', { name: 'การค้นหาปัจจุบัน' }),
    ).not.toBeInTheDocument();
    const region = formRegion(container);
    expect(region).toHaveAttribute('data-open', 'true');
    expect(region).not.toHaveAttribute('inert');
  });

  it('folds the form into a bar that reads the term and the busy text', () => {
    const { container } = renderHeader();
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
    });
    const region = formRegion(container);
    expect(region).toHaveAttribute('data-open', 'false');
    expect(region).toHaveAttribute('inert');
    const bar = screen.getByRole('region', { name: 'การค้นหาปัจจุบัน' });
    expect(bar).toHaveAccessibleDescription(/รหัสวิชา/);
    expect(bar).toHaveAccessibleDescription(/ภาค 1\/2569/);
    expect(bar).toHaveAccessibleDescription(/กำลังค้นหารายวิชา/);

    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, subjectQuery);
    });
    expect(bar).toHaveAccessibleDescription(/2 รายวิชา/);
    expect(bar).not.toHaveAccessibleDescription(/กำลังค้นหารายวิชา/);
  });

  it('keeps the disclosure label and focus while it toggles the form', () => {
    const { container } = renderHeader();
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
    });
    const disclosure = screen.getByRole('button', { name: 'แก้ไขการค้นหา' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', SEARCH_FORM_ID);
    disclosure.focus();

    fireEvent.click(disclosure, { detail: 1 });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    expect(formRegion(container)).not.toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'แก้ไขการค้นหา' })).toBe(
      disclosure,
    );
    expect(disclosure).toHaveFocus();

    fireEvent.click(disclosure, { detail: 1 });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(formRegion(container)).toHaveAttribute('data-open', 'false');
    expect(disclosure).toHaveFocus();
  });

  it('ignores the second click of a double click on the disclosure', () => {
    renderHeader();
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
    });
    const disclosure = screen.getByRole('button', { name: 'แก้ไขการค้นหา' });
    fireEvent.click(disclosure, { detail: 1 });
    fireEvent.click(disclosure, { detail: 2 });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  });
});
