import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { RequestMessage, TeachTableQuery } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { err, httpError, ok, type Result } from '@/lib/utils/result';
import { CatalogPanel } from '@/features/catalog/CatalogPanel';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import {
  fakeSearchDeps,
  teachTableResult,
} from '../../../tests/support/searchDeps';
import { makeCourse } from '../../../tests/support/domain-builders';
import { loadFixture } from '../../../tests/support/fixtures';
import { TEACH_TABLE_TTL_MS } from '@/lib/storage/keys';
import type {
  SearchState,
  SearchStateRepository,
} from '@/lib/storage/lastSearch';
import { toastStore } from '@/features/shell/toastStore';
import { useFocusTrap } from '@/features/shell/useFocusTrap';
import { SearchDepsProvider } from './SearchDepsContext';
import { SearchHeader } from './SearchHeader';
import {
  SEARCH_BAR_ID,
  SEARCH_DISCLOSURE_ID,
  SEARCH_FORM_ID,
  SEARCH_SUBJECT_ID_INPUT_ID,
} from './searchIds';
import { searchStore } from './searchStore';

const term = { year: '2569', semester: '1' } as const;

// The exact 400 body the registration server returns for a subject id whose length is
// not eight. The cast names the shape the test reads from the untrusted fixture.
const subjectIdRejection = loadFixture(
  'regressions/teach-table.subject-id-length.error.json',
) as { message: Record<string, string[]> };

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

function renderHeader(compact = false) {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <SearchHeader compact={compact} />
    </SearchDepsProvider>,
  );
}

/** The submit row, the block that holds the submit and, on the phone, the cancel. */
function submitRow(): HTMLElement {
  const row = screen.getByRole('button', { name: 'ค้นหา' }).parentElement
    ?.parentElement;
  if (row == null) throw new Error('the submit row is not rendered');
  return row;
}

function formRegion(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>(`#${SEARCH_FORM_ID}`);
  if (node === null) throw new Error('the search form region is not rendered');
  return node;
}

beforeEach(() => {
  const state = searchStore.getState();
  state.hydrate({
    schemaVersion: 2,
    activeTab: 'by_subject_id',
    term,
    byClass: defaultClassForm(),
    bySubjectId: { ...defaultSubjectIdForm(), subjectId: '90592033' },
    byCategory: defaultCategoryForm(),
  });
  state.cancelSearch();
  state.setInitialized(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it('says when the data was fetched and turns warn past the cache lifetime', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 14, 32));
    try {
      renderHeader();
      act(() => {
        searchStore.getState().startQuery(subjectQuery, 'user');
      });
      const bar = screen.getByRole('region', { name: 'การค้นหาปัจจุบัน' });
      expect(bar).not.toHaveAccessibleDescription(/ข้อมูล ณ/);
      act(() => {
        searchStore
          .getState()
          .setResult(
            { status: 'ready', data: catalog },
            subjectQuery,
            Date.now(),
          );
      });
      expect(bar).toHaveAccessibleDescription(/ข้อมูล ณ 14:32/);
      const time = screen.getByText('ข้อมูล ณ 14:32');
      expect(time).toHaveAttribute('data-stale', 'false');
      act(() => {
        vi.advanceTimersByTime(TEACH_TABLE_TTL_MS);
      });
      expect(time).toHaveAttribute('data-stale', 'true');
      expect(time).toHaveClass('text-warn');
    } finally {
      vi.useRealTimers();
    }
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

// A send that answers the first query with the given result and leaves every later one
// in flight, so a retry or refresh stays loading while the test reads focus. The cast is
// required for the same reason as above.
function answerOnceSend(first: Result<NormalizedCatalog>): TypedSend {
  const answer = first.ok ? ok(teachTableResult(first.value)) : first;
  let queries = 0;
  const handler = (message: RequestMessage) => {
    if (message.type === 'teachTable/query') {
      queries += 1;
      return queries === 1
        ? Promise.resolve(answer)
        : new Promise<never>(() => undefined);
    }
    return Promise.resolve(ok(null));
  };
  return handler as unknown as TypedSend;
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

  it('moves focus to the bar when a retry replaces the error card', async () => {
    renderColumn(answerOnceSend(err(httpError(500, 'boom'))));
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    const retry = await screen.findByRole('button', { name: 'ลองอีกครั้ง' });
    retry.focus();
    fireEvent.click(retry);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.activeElement?.id).toBe(SEARCH_BAR_ID);
  });

  it('keeps focus on the refresh while it runs', async () => {
    renderColumn(answerOnceSend(ok(catalog)));
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    await screen.findByText('ข้อมูล ณ', { exact: false });
    const refresh = screen.getByRole('button', { name: 'โหลดผลค้นหาใหม่' });
    refresh.focus();
    fireEvent.click(refresh);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    // The control stays in place, held and described by the busy text beside it.
    expect(refresh).toHaveFocus();
    expect(refresh).toHaveAttribute('aria-disabled', 'true');
    expect(refresh).toHaveAccessibleDescription('กำลังค้นหารายวิชา');
  });

  it('starts nothing from a held refresh', () => {
    const counting = countingSend();
    renderColumn(counting.send);
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    const refresh = screen.getByRole('button', { name: 'โหลดผลค้นหาใหม่' });
    expect(refresh).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(refresh);
    expect(counting.queries()).toBe(1);
  });

  it('toasts when a refresh returns unchanged data', async () => {
    const send = ((message: RequestMessage) =>
      message.type === 'teachTable/query'
        ? Promise.resolve(ok(teachTableResult(catalog)))
        : Promise.resolve(ok(null))) as unknown as TypedSend;
    renderColumn(send);
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    await screen.findByText('ข้อมูล ณ', { exact: false });
    fireEvent.click(screen.getByRole('button', { name: 'โหลดผลค้นหาใหม่' }));
    await waitFor(() => {
      expect(toastStore.getState().toast?.message).toBe(
        'ข้อมูลเป็นปัจจุบัน ไม่มีการเปลี่ยนแปลง',
      );
    });
  });

  // The error card's edit action shares the disclosure's label, so it is the one of the
  // two that controls no region.
  async function findEditAction(): Promise<HTMLElement> {
    await screen.findByRole('heading', { name: 'โหลดรายวิชาไม่สำเร็จ' });
    const action = screen
      .getAllByRole('button', { name: 'แก้ไขการค้นหา' })
      .find((button) => button.id !== SEARCH_DISCLOSURE_ID);
    if (action === undefined) throw new Error('the edit action is missing');
    return action;
  }

  it('opens the form and focuses the disclosure for a rejected query', async () => {
    const { container } = renderColumn(
      answerOnceSend(err(httpError(400, 'rejected'))),
    );
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    fireEvent.click(await findEditAction());
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    expect(document.activeElement?.id).toBe(SEARCH_DISCLOSURE_ID);
  });

  it('opens the subject id tab and focuses the field for a rejected id', async () => {
    const { container } = renderColumn(
      answerOnceSend(
        err(httpError(400, 'rejected', subjectIdRejection.message)),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    const action = await findEditAction();
    act(() => {
      searchStore.getState().setActiveTab('by_class');
    });
    fireEvent.click(action);
    expect(searchStore.getState().activeTab).toBe('by_subject_id');
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    expect(document.activeElement?.id).toBe(SEARCH_SUBJECT_ID_INPUT_ID);
    expect(screen.getByRole('textbox', { name: 'รหัสวิชา' })).toHaveFocus();
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

// The overlay panel in miniature: a focus trap that closes on Escape around the search
// head, so the test proves each surface claims one press, innermost first.
function TrappedHeader({ onEscape }: { onEscape: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onEscape);
  return (
    <div ref={ref} role="dialog" aria-label="panel" tabIndex={-1}>
      <SearchHeader />
    </div>
  );
}

function renderTrapped(onEscape: () => void) {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <TrappedHeader onEscape={onEscape} />
    </SearchDepsProvider>,
  );
}

describe('search head Escape', () => {
  it('closes the open list, then folds the form, then closes the overlay', () => {
    const onEscape = vi.fn();
    const { container } = renderTrapped(onEscape);
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
    });
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขการค้นหา' }), {
      detail: 1,
    });
    const year = screen.getByRole('combobox', { name: 'ปีการศึกษา' });
    year.focus();
    fireEvent.keyDown(year, { key: 'ArrowDown' });
    expect(year).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(year, { key: 'Escape' });
    expect(year).toHaveAttribute('aria-expanded', 'false');
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    expect(onEscape).not.toHaveBeenCalled();

    fireEvent.keyDown(year, { key: 'Escape' });
    expect(formRegion(container)).toHaveAttribute('data-open', 'false');
    expect(formRegion(container)).toHaveAttribute('inert');
    expect(document.activeElement?.id).toBe(SEARCH_DISCLOSURE_ID);
    expect(onEscape).not.toHaveBeenCalled();

    if (document.activeElement === null) throw new Error('focus was lost');
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('leaves the Escape that ends a composition to the field', () => {
    const onEscape = vi.fn();
    const { container } = renderTrapped(onEscape);
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
    });
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขการค้นหา' }), {
      detail: 1,
    });
    const field = screen.getByRole('textbox', { name: 'รหัสวิชา' });
    field.focus();
    fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    expect(field).toHaveFocus();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('closes the overlay at once while there is no bar to fold to', () => {
    const onEscape = vi.fn();
    const { container } = renderTrapped(onEscape);
    const field = screen.getByRole('textbox', { name: 'รหัสวิชา' });
    field.focus();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(formRegion(container)).toHaveAttribute('data-open', 'true');
  });
});

describe('search head after a reload', () => {
  const lastSearch: SearchState = {
    schemaVersion: 2,
    activeTab: 'by_subject_id',
    term,
    byClass: defaultClassForm(),
    bySubjectId: { subjectId: '90592033' },
    byCategory: defaultCategoryForm(),
  };

  interface Release {
    repo: SearchStateRepository;
    release: () => void;
  }

  // A repository whose load the test settles, so the placeholder can be read first.
  function heldRepo(): Release {
    let resolve: (state: SearchState) => void = () => undefined;
    const pending = new Promise<SearchState>((settle) => {
      resolve = settle;
    });
    return {
      repo: { load: () => pending, save: () => Promise.resolve() },
      release: () => {
        resolve(lastSearch);
      },
    };
  }

  // Watches every commit for an open form, which a reload must never paint.
  function watchOpenForm(container: HTMLElement): () => boolean {
    let seen = false;
    const check = () => {
      seen ||=
        container.querySelector(`#${SEARCH_FORM_ID}[data-open="true"]`) !==
        null;
    };
    const observer = new MutationObserver(check);
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    return () => {
      check();
      observer.disconnect();
      return seen;
    };
  }

  function bootAndRender(
    repo: SearchStateRepository,
    send: TypedSend = fakeSearchDeps().send,
  ) {
    // The app boots the load at mount, ahead of the first open.
    searchStore.getState().bootSearch(repo);
    return render(
      <SearchDepsProvider value={fakeSearchDeps({ repo, send })}>
        <SearchHeader />
        <CatalogPanel />
      </SearchDepsProvider>,
    );
  }

  const restoredRepo: SearchStateRepository = {
    load: () => Promise.resolve(lastSearch),
    save: () => Promise.resolve(),
  };

  afterEach(() => {
    window.location.hash = '';
  });

  it('paints the placeholder, then the folded bar, and never the open form', async () => {
    const held = heldRepo();
    const openFormSeen = watchOpenForm(document.body);
    const { container } = bootAndRender(held.repo);
    expect(container.querySelector(`#${SEARCH_FORM_ID}`)).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'การค้นหาปัจจุบัน' }),
    ).not.toBeInTheDocument();
    held.release();
    const bar = await screen.findByRole('region', { name: 'การค้นหาปัจจุบัน' });
    expect(bar).toHaveAccessibleDescription(/ภาค 1\/2569/);
    expect(formRegion(container)).toHaveAttribute('data-open', 'false');
    expect(openFormSeen()).toBe(false);
  });

  it('opens the form with no bar for a host route on another term', async () => {
    window.location.hash =
      '#/teach_table?mode=by_subject_id&selected_year=2568&selected_semester=2';
    const { container } = bootAndRender(restoredRepo);
    await waitFor(() => {
      expect(formRegion(container)).toHaveAttribute('data-open', 'true');
    });
    expect(
      screen.queryByRole('region', { name: 'การค้นหาปัจจุบัน' }),
    ).not.toBeInTheDocument();
    expect(searchStore.getState().term).toEqual({
      year: '2568',
      semester: '2',
    });
  });

  it('runs the restored search again as a user search and keeps focus', async () => {
    const counting = countingSend();
    bootAndRender(restoredRepo, counting.send);
    const rerun = await screen.findByRole('button', { name: 'ค้นหาอีกครั้ง' });
    rerun.focus();
    fireEvent.click(rerun);
    expect(counting.queries()).toBe(1);
    const state = searchStore.getState();
    expect(state.resultQuery).toBe(state.barQuery);
    expect(state.resultIntent).toBe('user');
    // The same control turns into the held refresh, so focus never leaves it.
    expect(rerun).toHaveFocus();
    expect(rerun).toHaveAccessibleName('โหลดผลค้นหาใหม่');
    expect(rerun).toHaveAttribute('aria-disabled', 'true');
    expect(rerun).toHaveAccessibleDescription('กำลังค้นหารายวิชา');
    fireEvent.click(rerun);
    expect(counting.queries()).toBe(1);
  });
});

describe('SearchHeader on the phone layout', () => {
  it('fills the pane with the open form over a pinned submit row', () => {
    const { container } = renderHeader(true);
    const head = container.firstElementChild;
    expect(head).toHaveClass('absolute', 'inset-0');
    expect(formRegion(container)).toHaveClass('flex-1');
    expect(submitRow()).toHaveClass('sticky', 'bottom-0');
    // Before any search there is no bar to fold back to, so no cancel shows.
    expect(
      screen.queryByRole('button', { name: 'ยกเลิก' }),
    ).not.toBeInTheDocument();
  });

  it('pads the form scroll by the pinned row height so focus clears it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(68);
    const { container } = renderHeader(true);
    const scroller = formRegion(container).firstElementChild;
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('the form scroller is not rendered');
    }
    expect(scroller.style.scrollPaddingBottom).toBe(
      'calc(68px + var(--kcp-overlay-bottom, 0px))',
    );
  });

  it('folds the reopened form back under its bar from the cancel', () => {
    const { container } = renderHeader(true);
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
    });
    const head = container.firstElementChild;
    // Folded, the head returns to the flow above the results with its bar alone.
    expect(head).not.toHaveClass('absolute');
    expect(submitRow()).not.toHaveClass('sticky');

    fireEvent.click(screen.getByRole('button', { name: 'แก้ไขการค้นหา' }), {
      detail: 1,
    });
    expect(head).toHaveClass('absolute');
    const cancel = screen.getByRole('button', { name: 'ยกเลิก' });
    expect(cancel.parentElement).toBe(
      screen.getByRole('button', { name: 'ค้นหา' }).parentElement,
    );
    cancel.focus();
    fireEvent.click(cancel);
    expect(formRegion(container)).toHaveAttribute('data-open', 'false');
    expect(formRegion(container)).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'แก้ไขการค้นหา' })).toHaveFocus();
    // The cancel only folds; the running search keeps its bar.
    expect(searchStore.getState().barQuery).toBe(subjectQuery);
  });

  it('keeps the submit in the flow with no cancel from 640 px up', () => {
    const { container } = renderHeader();
    act(() => {
      searchStore.getState().startQuery(subjectQuery, 'user');
      searchStore.getState().setSearchFormOpen(true);
    });
    expect(container.firstElementChild).not.toHaveClass('absolute');
    expect(submitRow()).not.toHaveClass('sticky');
    expect(
      screen.queryByRole('button', { name: 'ยกเลิก' }),
    ).not.toBeInTheDocument();
  });
});
