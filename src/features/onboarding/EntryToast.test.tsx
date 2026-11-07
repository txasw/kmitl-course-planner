import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  ENTRY_TOAST_DELAY_MS,
  ENTRY_TOAST_VISIBLE_MS,
} from '@/lib/onboarding/entryToast';
import type { RequestMessage } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import { routeSearchPrefill } from '@/lib/search/queryForms';
import type { SearchState } from '@/lib/storage/lastSearch';
import type { OnboardingRecord } from '@/lib/storage/onboarding';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { Launcher, LAUNCHER_ID } from '@/features/shell/Launcher';
import { uiStore } from '@/features/shell/uiStore';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { searchStore } from '@/features/search/searchStore';
import { makePlanEntry } from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { reviewedEntry } from '../../../tests/support/review';
import { installViewport } from '../../../tests/support/viewport';
import { EntryToast } from './EntryToast';
import { initialOnboardingData, onboardingStore } from './onboardingStore';

// The route mapping stays real; one test swaps in a prefill the form cannot submit,
// which no real route maps to, to prove the action then sends nothing.
vi.mock('@/lib/search/queryForms', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/search/queryForms')>();
  return { ...actual, routeSearchPrefill: vi.fn(actual.routeSearchPrefill) };
});

const NO_PLAN =
  'ใช้ Planner วางแผนตารางเรียนจากรายวิชาที่เปิดสอนในเว็บไซต์นี้ได้';
const CLOSE = 'ปิดข้อความนี้';
const OPT_OUT = 'ไม่ต้องแสดงข้อความนี้อีก';
const ROUTE = 'เปิดผลการค้นหานี้ใน Planner เพื่อจัดกลุ่มเรียนลงตาราง';
const ROUTE_ACTION = 'เปิดใน Planner';
const RESULT_HASH =
  '#/teach_table?mode=by_subject_owner_id&selected_year=2569&selected_semester=1&selected_faculty=01&search_all_faculty=false&selected_subject_owner_id=46';

function fakeRecord() {
  return {
    patch: vi.fn((fields: Partial<OnboardingRecord>) =>
      Promise.resolve<OnboardingRecord>({ schemaVersion: 1, ...fields }),
    ),
  };
}

function settle(): void {
  act(() => {
    planStore.setState({ loaded: true });
    const store = onboardingStore.getState();
    store.hydrate(null, { schemaVersion: 1 });
    store.settleHandshake();
    store.settleWelcome();
  });
}

function show(): void {
  settle();
  act(() => {
    vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS);
  });
}

function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[aria-live]');
  if (region === null) throw new Error('The entry toast region is not mounted');
  return region;
}

beforeEach(() => {
  vi.useFakeTimers();
  installViewport(390);
  uiStore.setState({
    isOpen: false,
    viewMode: 'preview',
    mobilePane: 'plan',
    planView: 'selected',
  });
  revalidationStore.getState().setUpdatesOpen(false);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
  revalidationStore.getState().setUpdatesOpen(false);
  onboardingStore.setState(initialOnboardingData());
  resetPlanStore();
  planStore.setState({ loaded: false });
});

describe('EntryToast region', () => {
  it('keeps an empty polite region in the panel language before the show', () => {
    const { container } = render(<EntryToast record={fakeRecord()} />);
    const region = liveRegion(container);
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveAttribute('lang', 'th');
    expect(region).toBeEmptyDOMElement();

    show();
    expect(liveRegion(container)).toBe(region);
    expect(region).toHaveTextContent(NO_PLAN);
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(region).toHaveAttribute('lang', 'en');
  });

  it('never moves focus when it shows', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.append(mount);
    try {
      outside.focus();
      render(<EntryToast record={fakeRecord()} />, { container: mount });
      show();
      expect(within(mount).getByText(NO_PLAN)).toBeInTheDocument();
      expect(document.activeElement).toBe(outside);
      expect(shadow.activeElement).toBeNull();
    } finally {
      host.remove();
      outside.remove();
    }
  });

  it('enters with the toast entrance, which reduced motion removes', () => {
    const { container } = render(<EntryToast record={fakeRecord()} />);
    show();
    expect(container.querySelector('[data-entry-toast]')).toHaveClass(
      'kcp-toast-enter',
    );
    const css = readFileSync(
      resolve(process.cwd(), 'src/entrypoints/regis.content/style.css'),
      'utf8',
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.kcp-toast-enter \{\s*animation: none;/,
    );
  });
});

describe('EntryToast dismissal', () => {
  it('hides for the document on close', () => {
    const record = fakeRecord();
    render(<EntryToast record={record} />);
    show();
    fireEvent.click(screen.getByRole('button', { name: CLOSE }));
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    expect(record.patch).not.toHaveBeenCalled();
  });

  it('closes on Escape with focus inside and hands focus to the launcher', () => {
    render(
      <>
        <Launcher />
        <EntryToast record={fakeRecord()} />
      </>,
    );
    show();
    const close = screen.getByRole('button', { name: CLOSE });
    close.focus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    expect(document.activeElement?.id).toBe(LAUNCHER_ID);
  });

  it('records the opt out and hides on Do not show again', async () => {
    const record = fakeRecord();
    render(<EntryToast record={record} />);
    show();
    fireEvent.click(screen.getByRole('button', { name: OPT_OUT }));
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    expect(record.patch).toHaveBeenCalledTimes(1);
    const fields = record.patch.mock.calls[0]?.[0];
    expect(fields?.entryToastOptOutAt).toEqual(expect.any(String));
    expect(onboardingStore.getState().record.entryToastOptOutAt).toBeDefined();
    await act(async () => {
      await Promise.resolve();
    });
    expect(onboardingStore.getState().record.entryToastOptOutAt).toBe(
      fields?.entryToastOptOutAt,
    );
  });

  it('hides when the panel opens and stays hidden after it closes', () => {
    render(<EntryToast record={fakeRecord()} />);
    show();
    act(() => {
      uiStore.getState().open();
    });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
    act(() => {
      uiStore.getState().close();
      vi.advanceTimersByTime(ENTRY_TOAST_DELAY_MS + ENTRY_TOAST_VISIBLE_MS);
    });
    expect(screen.queryByText(NO_PLAN)).toBeNull();
  });
});

describe('EntryToast actions', () => {
  function pressAction(name: string): void {
    render(<EntryToast record={fakeRecord()} />);
    show();
    fireEvent.click(screen.getByRole('button', { name }));
  }

  it('opens the catalog in edit when there is no plan', () => {
    pressAction('เปิด Planner');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.mobilePane).toBe('catalog');
  });

  it('opens the catalog in edit for an empty plan', () => {
    act(() => {
      seedActivePlan([]);
    });
    pressAction('เพิ่มวิชา');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.mobilePane).toBe('catalog');
  });

  it('opens the timetable for a plan with subjects', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    pressAction('เปิดตาราง');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.mobilePane).toBe('plan');
    expect(ui.planView).toBe('timetable');
    expect(revalidationStore.getState().updatesOpen).toBe(false);
  });

  it('opens the timetable in edit with the updates dialog for changes to review', () => {
    act(() => {
      seedActivePlan([reviewedEntry('1')]);
    });
    pressAction('ตรวจสอบ');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.planView).toBe('timetable');
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });
});

describe('EntryToast route offer', () => {
  const persisted: SearchState = {
    schemaVersion: 2,
    activeTab: 'by_subject_id',
    term: { year: '2568', semester: '2' },
    byClass: defaultClassForm(),
    bySubjectId: { subjectId: '90592033' },
    byCategory: defaultCategoryForm(),
  };

  // A send whose query never answers, so the store can be read while it is in flight.
  // The cast is required because a single arrow cannot satisfy the generic send.
  function querySpy() {
    const spy = vi.fn((message: RequestMessage) =>
      message.type === 'teachTable/query'
        ? new Promise<never>(() => undefined)
        : Promise.resolve({ ok: true, value: null }),
    );
    return { spy, send: spy as unknown as TypedSend };
  }

  function queries(spy: ReturnType<typeof querySpy>['spy']): RequestMessage[] {
    return spy.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'teachTable/query');
  }

  function renderOnRoute(send: TypedSend): void {
    window.history.replaceState(null, '', RESULT_HASH);
    render(
      <SearchDepsProvider
        value={{
          send,
          repo: {
            load: () => Promise.resolve(persisted),
            save: () => Promise.resolve(),
          },
        }}
      >
        <EntryToast record={fakeRecord()} />
      </SearchDepsProvider>,
    );
    show();
  }

  async function pressRouteAction(): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: ROUTE_ACTION }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }

  beforeEach(() => {
    const state = searchStore.getState();
    state.hydrate({
      schemaVersion: 2,
      activeTab: 'by_class',
      term: { year: '2569', semester: '1' },
      byClass: defaultClassForm(),
      bySubjectId: defaultSubjectIdForm(),
      byCategory: defaultCategoryForm(),
    });
    state.setInitialized(false);
  });

  afterEach(() => {
    act(() => {
      searchStore.getState().cancelSearch();
    });
  });

  it('offers the search of the result route the document loaded on', () => {
    const { send } = querySpy();
    renderOnRoute(send);
    expect(screen.getByText(ROUTE)).toBeInTheDocument();
  });

  it('runs the route search once over the persisted search and opens the catalog', async () => {
    const { spy, send } = querySpy();
    renderOnRoute(send);
    await pressRouteAction();

    expect(screen.queryByText(ROUTE)).toBeNull();
    expect(queries(spy)).toEqual([
      {
        type: 'teachTable/query',
        refresh: false,
        query: {
          mode: 'by_subject_owner_id',
          selected_year: '2569',
          selected_semester: '1',
          search_all_faculty: false,
          selected_faculty: '01',
          selected_subject_owner_id: '46',
        },
      },
    ]);
    const search = searchStore.getState();
    expect(search.activeTab).toBe('by_subject_owner_id');
    expect(search.byCategory).toEqual({ faculty: '01', subjectOwner: '46' });
    expect(search.bySubjectId).toEqual({ subjectId: '90592033' });
    expect(search.result.status).toBe('loading');
    const ui = uiStore.getState();
    expect(ui.isOpen).toBe(true);
    expect(ui.viewMode).toBe('edit');
    expect(ui.mobilePane).toBe('catalog');
  });

  it('sends nothing for a prefill the form cannot submit and still opens the catalog', async () => {
    vi.mocked(routeSearchPrefill).mockReturnValueOnce({
      tab: 'by_subject_owner_id',
      term: { year: '2569', semester: '1' },
      form: { faculty: '01', subjectOwner: '' },
    });
    const { spy, send } = querySpy();
    renderOnRoute(send);
    await pressRouteAction();

    expect(queries(spy)).toEqual([]);
    expect(searchStore.getState().activeTab).toBe('by_subject_owner_id');
    expect(uiStore.getState().isOpen).toBe(true);
    expect(uiStore.getState().mobilePane).toBe('catalog');
  });
});
