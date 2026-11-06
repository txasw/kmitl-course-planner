import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { RequestMessage, TeachTableQuery } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { ok } from '@/lib/utils/result';
import { CatalogPanel } from '@/features/catalog/CatalogPanel';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { makeCourse } from '../../../tests/support/domain-builders';
import { SearchDepsProvider } from './SearchDepsContext';
import { SearchHeader } from './SearchHeader';
import { SEARCH_BAR_ID, SEARCH_FORM_ID } from './searchIds';
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

  it('clamps a long category name and keeps the scope chip whole', () => {
    const longName =
      '90641xxx กลุ่มวิชาเลือกเสรีด้านนวัตกรรมการผลิตขั้นสูงและการจัดการอุตสาหกรรมเพื่อความยั่งยืนของชุมชน';
    const categoryQuery: TeachTableQuery = {
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '2',
      search_all_faculty: true,
      selected_subject_owner_id: '77',
    };
    renderHeader();
    act(() => {
      searchStore.getState().setSubjectOwners({
        status: 'ready',
        data: [
          {
            TEACH_TABLE_SUBJECT_OWNER_ID: '77',
            TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_TH: longName,
            TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_EN: longName,
          },
        ],
      });
      searchStore.getState().startQuery(categoryQuery, 'user');
    });
    const bar = screen.getByRole('region', { name: 'การค้นหาปัจจุบัน' });
    const primary = screen.getByText(`หมวดวิชา ${longName}`);
    expect(primary).toHaveClass('line-clamp-2');
    expect(primary).not.toHaveAttribute('title');
    const chip = screen.getByText('ทุกคณะ');
    expect(chip).toHaveClass('whitespace-nowrap', 'shrink-0');
    expect(chip).not.toHaveClass('truncate');
    expect(primary).not.toContainElement(chip);
    expect(bar).toHaveAccessibleDescription(
      `หมวดวิชา ${longName} ภาค 2/2569 ทุกคณะ กำลังค้นหารายวิชา`,
    );
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

interface CountingSend {
  send: TypedSend;
  queries: () => number;
}

// A send that counts the queries it is asked and never answers them, so a search
// stays in flight. The cast is required because a single arrow cannot satisfy the
// generic send signature.
function countingSend(): CountingSend {
  let queries = 0;
  const handler = (message: RequestMessage) => {
    if (message.type === 'teachTable/query') {
      queries += 1;
      return new Promise<never>(() => undefined);
    }
    return Promise.resolve(ok(null));
  };
  return { send: handler as unknown as TypedSend, queries: () => queries };
}

function renderColumn(send: TypedSend) {
  return render(
    <SearchDepsProvider value={fakeSearchDeps({ send })}>
      <SearchHeader />
      <CatalogPanel />
    </SearchDepsProvider>,
  );
}

describe('search focus', () => {
  it('folds the form and focuses the bar inside the submit click', () => {
    const { container } = renderColumn(countingSend().send);
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    const region = formRegion(container);
    expect(region).toHaveAttribute('data-open', 'false');
    expect(region).toHaveAttribute('inert');
    expect(document.activeElement?.id).toBe(SEARCH_BAR_ID);
  });

  it('keeps the form open for a short subject id', () => {
    act(() => {
      searchStore.getState().patchSubjectIdForm({ subjectId: '123' });
    });
    const counting = countingSend();
    const { container } = renderColumn(counting.send);
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    expect(
      screen.queryByRole('region', { name: 'การค้นหาปัจจุบัน' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'รหัสวิชา' })).toHaveFocus();
    expect(counting.queries()).toBe(0);
  });

  it('starts nothing on a second Enter after the bar takes focus', () => {
    const counting = countingSend();
    renderColumn(counting.send);
    const field = screen.getByRole('textbox', { name: 'รหัสวิชา' });
    field.focus();
    fireEvent.keyDown(field, { key: 'Enter' });
    const bar = screen.getByRole('region', { name: 'การค้นหาปัจจุบัน' });
    expect(bar).toHaveFocus();
    fireEvent.keyDown(bar, { key: 'Enter' });
    expect(counting.queries()).toBe(1);
  });

  it('reopens the form and focuses submit when a slow search is cancelled', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderColumn(countingSend().send);
      fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
      act(() => {
        vi.advanceTimersByTime(8_000);
      });
      fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
      expect(formRegion(container)).toHaveAttribute('data-open', 'true');
      expect(formRegion(container)).not.toHaveAttribute('inert');
      expect(screen.getByRole('button', { name: 'ค้นหา' })).toHaveFocus();
      expect(searchStore.getState().barQuery).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
