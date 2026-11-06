import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { searchStore } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import type { PlanEntry } from '@/lib/domain/plan';
import { EXPORT_TEMPLATES } from '@/lib/planner/exportTemplates';
import type { Meeting } from '@/lib/domain/types';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { dragStore } from './dragStore';
import { PlannerPanel } from './PlannerPanel';

// The panel always renders inside the search deps provider in the app; the
// verification status reads it for the manual check send.
function renderPanel() {
  return render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <PanelPortalContext.Provider value={document.body}>
        <PlannerPanel />
      </PanelPortalContext.Provider>
    </SearchDepsProvider>,
  );
}

function seed(entries: PlanEntry[]): void {
  act(() => {
    planStore.setState({ entries });
  });
}

/** Load a catalog result with one section nothing has placed. */
function seedCatalog(meeting: Meeting): void {
  const offered = makeSection({
    teachTableId: 'c1',
    subjectId: '90000003',
    meetings: [meeting],
  });
  act(() => {
    searchStore.setState({
      result: {
        status: 'ready',
        data: {
          courses: [makeCourse({ subjectId: '90000003', sections: [offered] })],
          duplicateCount: 0,
          multiMeetingCount: 0,
          warnings: [],
        },
      },
    });
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  seed([]);
  act(() => {
    searchStore.setState({ result: { status: 'idle' } });
    dragStore.getState().clearActive();
  });
  act(() => {
    uiStore.getState().setViewMode('edit');
    uiStore.getState().setPlanView('timetable');
    revalidationStore.getState().setUpdatesOpen(false);
    revalidationStore.setState({ runs: {} });
  });
});

/** Two placed subjects, one of them a lecture and practice pair. */
function seedTwoSubjects(): void {
  const meetings = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
  seed([
    makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'p1',
        subjectId: '90000001',
        section: '901',
        meetings,
      }),
    }),
    makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'p2',
        subjectId: '90000001',
        section: '902',
        meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 720 })],
      }),
    }),
    makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 's1',
        subjectId: '90000002',
        section: '1',
        meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 720 })],
      }),
    }),
  ]);
}

describe('PlannerPanel plan views', () => {
  it('shows the plan view tabs with the subject count on a laptop', () => {
    installViewport(1366);
    seedTwoSubjects();
    renderPanel();
    expect(screen.getByRole('tablist', { name: 'มุมมองตาราง' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'ตารางเรียน' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('tabpanel', { name: 'ตารางเรียน' }),
    ).toContainElement(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    );
    expect(
      screen.getByRole('tab', { name: 'วิชาที่เลือก (2)' }),
    ).toBeInTheDocument();
  });

  it('switches the region to the selected courses list', () => {
    installViewport(1366);
    seedTwoSubjects();
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'วิชาที่เลือก (2)' }));
    const panel = screen.getByRole('tabpanel', { name: 'วิชาที่เลือก (2)' });
    expect(panel).toContainElement(
      screen.getByRole('list', { name: 'วิชาที่เลือก' }),
    );
    expect(
      screen.queryByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeNull();
    expect(uiStore.getState().planView).toBe('selected');
  });

  it('clears an open block popover when the selected view replaces the grid', () => {
    installViewport(1366);
    seedTwoSubjects();
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /90000002/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'วิชาที่เลือก (2)' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('follows the plan view the bottom nav picks on a phone, with no tabs', () => {
    installViewport(390);
    seedTwoSubjects();
    act(() => {
      uiStore.getState().setPlanView('selected');
    });
    renderPanel();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(
      screen.getByRole('list', { name: 'วิชาที่เลือก' }),
    ).toBeInTheDocument();

    act(() => {
      uiStore.getState().setPlanView('timetable');
    });
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนวันจันทร์' }),
    ).toBeInTheDocument();
  });

  it('renders no tabs in preview', () => {
    installViewport(1366);
    seedTwoSubjects();
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    renderPanel();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('list', { name: 'วิชาที่เลือก' })).toBeNull();
  });

  it('switches the region to the summary with the exam schedule', () => {
    installViewport(1366);
    seedTwoSubjects();
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'สรุป' }));
    const panel = screen.getByRole('tabpanel', { name: 'สรุป' });
    expect(panel).toContainElement(
      screen.getByRole('region', { name: 'ตารางสอบ' }),
    );
    expect(
      screen.queryByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeNull();
    expect(uiStore.getState().planView).toBe('summary');
  });

  it('marks the summary tab while two placed subjects clash on an exam', () => {
    installViewport(1366);
    const midterm = {
      start: '2026-12-17 09:00:00',
      end: '2026-12-17 12:00:00',
    };
    seed(
      ['90000001', '90000002'].map((subjectId, index) =>
        makePlanEntry({
          snapshot: makeSnapshot({
            teachTableId: `e${String(index)}`,
            subjectId,
            section: '901',
            meetings: [makeMeeting({ day: index === 0 ? 1 : 2 })],
            exam: { midterm },
          }),
        }),
      ),
    );
    renderPanel();
    fireEvent.click(
      screen.getByRole('tab', { name: 'สรุป มีวิชาที่สอบชนกัน' }),
    );
    expect(
      screen.getByText(/^สอบชนกับ 90000002 .* กลุ่มเรียน 901$/),
    ).toBeVisible();
  });

  it('offers the way to the catalog when the plan is empty', () => {
    installViewport(1366);
    act(() => {
      uiStore.getState().setPlanView('summary');
    });
    renderPanel();
    expect(screen.getByText('ยังไม่มีรายวิชาในตาราง')).toBeVisible();
    expect(screen.getByRole('button', { name: 'ไปที่รายวิชา' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'ตารางสอบ' })).toBeNull();
  });

  it('has no serious accessibility violations in the summary view', async () => {
    installViewport(1366);
    seedTwoSubjects();
    act(() => {
      uiStore.getState().setPlanView('summary');
    });
    const { container } = renderPanel();
    await expectNoSeriousA11yViolations(container);
  });

  it('shows the updates indicator beside the tabs and opens the dialog from it', () => {
    installViewport(1366);
    const snapshot = makeSnapshot({
      teachTableId: 'r1',
      subjectId: '90000001',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    seed([
      makePlanEntry({
        snapshot,
        verifyStatus: 'changed',
        review: {
          kinds: ['room_changed'],
          before: snapshot,
          detectedAt: '2026-11-06T00:00:00.000Z',
          notifiedAt: '2026-11-06T00:00:00.000Z',
        },
      }),
    ]);
    renderPanel();
    const indicator = screen.getByRole('button', {
      name: 'มีการเปลี่ยนแปลง 1 รายการ',
    });
    expect(screen.getByRole('tablist')).not.toContainElement(indicator);
    fireEvent.click(indicator);
    expect(
      screen.getByRole('dialog', { name: 'ข้อมูลในตารางมีการเปลี่ยนแปลง' }),
    ).toBeInTheDocument();
  });

  it('heads the phone plan pane with the updates indicator', () => {
    installViewport(390);
    const snapshot = makeSnapshot({
      teachTableId: 'm1',
      subjectId: '90000001',
    });
    seed([makePlanEntry({ snapshot, verifyStatus: 'missing' })]);
    renderPanel();
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'มีการเปลี่ยนแปลง 1 รายการ' }),
    );
    expect(revalidationStore.getState().updatesOpen).toBe(true);
  });

  it('has no serious accessibility violations in the selected view', async () => {
    installViewport(1366);
    seedTwoSubjects();
    act(() => {
      uiStore.getState().setPlanView('selected');
    });
    const { container } = renderPanel();
    await expectNoSeriousA11yViolations(container);
  });
});

describe('PlannerPanel', () => {
  // The week grid shows on a laptop; a test that needs the phone installs its own width.
  beforeEach(() => {
    installViewport(1366);
  });

  it('shows the designed empty state when the plan has no sections', () => {
    renderPanel();
    expect(screen.getByText('ตารางยังว่าง')).toBeInTheDocument();
  });

  it('renders a scheduled block, the unscheduled shelf, and the grid', () => {
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 'o1',
          subjectId: '90000002',
          section: '1',
          meetings: [],
        }),
      }),
    ]);
    renderPanel();
    expect(screen.getByLabelText(/90000001/)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'รายวิชาที่ไม่มีคาบเรียน' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('ตารางยังว่าง')).not.toBeInTheDocument();
  });

  it('shows the working day in edit with no catalog result', () => {
    renderPanel();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.queryByText('07:00')).not.toBeInTheDocument();
    expect(screen.queryByText('18:00')).not.toBeInTheDocument();
  });

  it('widens the edit window to cover an evening catalog section', () => {
    seedCatalog(makeMeeting({ day: 3, startMin: 1140, endMin: 1230 }));
    renderPanel();
    // 19:00 to 20:30 in the catalog closes the window at 21:00, so 20:00 is labelled.
    expect(screen.getByText('20:00')).toBeInTheDocument();
    expect(screen.queryByText('21:00')).not.toBeInTheDocument();
  });

  it('keeps the frozen frame while a drag holds it', () => {
    renderPanel();
    act(() => {
      dragStore.getState().freezeFrame({
        window: { startMin: 480, endMin: 1080 },
        days: [1, 2, 3, 4, 5],
      });
    });
    // A search landing mid drag would widen the live frame to 21:00.
    seedCatalog(makeMeeting({ day: 3, startMin: 1140, endMin: 1230 }));
    expect(screen.queryByText('20:00')).not.toBeInTheDocument();

    act(() => {
      dragStore.getState().clearActive();
    });
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('hides the empty weekend rows in edit', () => {
    renderPanel();
    expect(screen.getByLabelText('วันจันทร์')).toBeInTheDocument();
    expect(screen.getByLabelText('วันศุกร์')).toBeInTheDocument();
    expect(screen.queryByLabelText('วันเสาร์')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('วันอาทิตย์')).not.toBeInTheDocument();
  });

  it('reveals the weekend rows for a Saturday catalog section', () => {
    seedCatalog(makeMeeting({ day: 6, startMin: 540, endMin: 720 }));
    renderPanel();
    expect(screen.getByLabelText('วันเสาร์')).toBeInTheDocument();
    expect(screen.getByLabelText('วันอาทิตย์')).toBeInTheDocument();
  });

  it('opens a block detail popover in edit mode and clears it in preview', () => {
    installViewport(1366);
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
    ]);
    renderPanel();
    // The block itself opens the pinned popover on click; there is no info affordance.
    fireEvent.click(screen.getByRole('button', { name: /90000001/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the block context menu, but never while a drag holds the gesture', () => {
    installViewport(1366);
    const meetings = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
    const placed = { teachTableId: 's1', subjectId: '90000001', meetings };
    seed([
      makePlanEntry({ snapshot: makeSnapshot({ ...placed, section: '901' }) }),
    ]);
    renderPanel();
    const block = () => screen.getByRole('button', { name: /90000001/ });

    const moving = makeSection(placed);
    act(() => {
      dragStore.getState().startBlockMove(moving, [moving], null);
    });
    expect(fireEvent.contextMenu(block())).toBe(false);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    act(() => {
      dragStore.getState().clearBlockMove();
    });
    fireEvent.contextMenu(block());
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('opens the block details as a bottom sheet on a phone', () => {
    installViewport(390);
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
    ]);
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /90000001/ }));
    const sheet = screen.getByRole('dialog');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(sheet.closest('[aria-live]')).toBeNull();
  });

  it('steps the edit grid font by the scroller width but never the poster', () => {
    // Every measured box reports a 1920 px screen's docked scroller, which sets the edit
    // grid at the 13 px step. The posters keep their template posterFontPx.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1472);
    seed([makePlanEntry()]);
    renderPanel();
    const gridFonts = () =>
      screen
        .getAllByRole('group', { name: 'ตารางเรียนรายสัปดาห์' })
        .map((grid) => grid.style.fontSize);
    expect(gridFonts()).toEqual(['13px']);

    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    const posterFonts = new Set(
      EXPORT_TEMPLATES.map((template) => `${String(template.posterFontPx)}px`),
    );
    const fonts = gridFonts();
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(posterFonts).toContain(font);
    }
    expect(fonts).not.toContain('13px');
  });

  it('shows the poster header in preview mode', () => {
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    renderPanel();
    expect(screen.getByRole('heading', { name: 'ตาราง' })).toBeInTheDocument();
  });

  it('renders the updates dialog only in edit and shows an item on the grid', async () => {
    // jsdom has no layout and does not implement scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
    installViewport(1366);
    seed([
      makePlanEntry({
        verifyStatus: 'missing',
        snapshot: makeSnapshot({
          teachTableId: 'm1',
          subjectId: '90000001',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
    ]);
    act(() => {
      uiStore.getState().setViewMode('preview');
      revalidationStore.getState().setUpdatesOpen(true);
    });
    renderPanel();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      uiStore.getState().setViewMode('edit');
    });
    const dialog = screen.getByRole('dialog', {
      name: 'ข้อมูลในตารางมีการเปลี่ยนแปลง',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: /^ดูในตาราง 90000001/ }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(revalidationStore.getState().updatesOpen).toBe(false);
    const block = document.querySelector<HTMLElement>(
      '[data-teach-table-id="m1"][data-block-order]',
    );
    await waitFor(() => {
      expect(block).toHaveFocus();
    });
    expect(block).toHaveClass('kcp-locate');
  });

  it('has no serious accessibility violations when populated', async () => {
    seed([
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 's1',
          subjectId: '90000001',
          section: '901',
          meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
        }),
      }),
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId: 'o1',
          subjectId: '90000002',
          section: '1',
          meetings: [],
        }),
      }),
    ]);
    const { container } = renderPanel();
    await expectNoSeriousA11yViolations(container);
  });
});

describe('PlannerPanel focus after a remove', () => {
  beforeEach(() => {
    installViewport(1366);
  });

  afterEach(() => {
    act(() => {
      resetPlanStore();
    });
  });

  // Three sections in time order: Monday 09:00, Monday 13:00, Tuesday 09:00. The DOM
  // lists the blocks by day lane, so time order is what decides the next one.
  function seedThree(): void {
    const entry = (
      teachTableId: string,
      subjectId: string,
      meeting: Meeting,
    ): PlanEntry =>
      makePlanEntry({
        teachTableId,
        subjectId,
        snapshot: makeSnapshot({
          teachTableId,
          subjectId,
          section: '901',
          meetings: [meeting],
        }),
      });
    act(() => {
      seedActivePlan([
        entry(
          'tue',
          '90000003',
          makeMeeting({ day: 2, startMin: 540, endMin: 600 }),
        ),
        entry(
          'mon-pm',
          '90000002',
          makeMeeting({ day: 1, startMin: 780, endMin: 840 }),
        ),
        entry(
          'mon-am',
          '90000001',
          makeMeeting({ day: 1, startMin: 540, endMin: 600 }),
        ),
      ]);
    });
  }

  function block(subjectId: string): HTMLElement {
    return screen.getByRole('button', { name: new RegExp(subjectId) });
  }

  function removeControl(subjectId: string): HTMLElement {
    const control = block(subjectId).parentElement?.querySelector<HTMLElement>(
      'button[aria-label="นำออก"]',
    );
    if (control == null) throw new Error(`no remove control for ${subjectId}`);
    return control;
  }

  it('moves focus to the next block in time order', () => {
    seedThree();
    renderPanel();
    const control = removeControl('90000001');
    control.focus();
    fireEvent.click(control);
    expect(screen.queryByRole('button', { name: /90000001/ })).toBeNull();
    expect(block('90000002')).toHaveFocus();
  });

  it('moves focus to the last block left after the last one goes', () => {
    seedThree();
    renderPanel();
    const control = removeControl('90000003');
    control.focus();
    fireEvent.click(control);
    expect(block('90000002')).toHaveFocus();
  });

  it('moves focus to the grid when no block is left', () => {
    installViewport(1366);
    act(() => {
      seedActivePlan([
        makePlanEntry({
          teachTableId: 's1',
          snapshot: makeSnapshot({
            teachTableId: 's1',
            subjectId: '90000001',
            section: '901',
            meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
          }),
        }),
      ]);
    });
    renderPanel();
    fireEvent.click(block('90000001'));
    const remove = screen.getByRole('button', { name: 'นำออกจากตาราง' });
    remove.focus();
    fireEvent.click(remove);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toHaveFocus();
  });

  it('moves focus on from a remove in the block context menu', () => {
    installViewport(1366);
    seedThree();
    renderPanel();
    fireEvent.contextMenu(block('90000002'));
    fireEvent.click(screen.getByRole('menuitem', { name: /นำออก/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(block('90000003')).toHaveFocus();
  });

  it('moves focus to the next shelf row after a shelf remove', () => {
    const unscheduled = (teachTableId: string, subjectId: string) =>
      makePlanEntry({
        teachTableId,
        subjectId,
        snapshot: makeSnapshot({
          teachTableId,
          subjectId,
          section: '1',
          meetings: [],
        }),
      });
    act(() => {
      seedActivePlan([
        unscheduled('o1', '90000004'),
        unscheduled('o2', '90000005'),
      ]);
    });
    renderPanel();
    const shelf = screen.getByRole('region', {
      name: 'รายวิชาที่ไม่มีคาบเรียน',
    });
    const [first] = shelf.querySelectorAll<HTMLElement>('[data-shelf-remove]');
    if (first === undefined) throw new Error('expected a shelf remove control');
    first.focus();
    fireEvent.click(first);
    expect(shelf.querySelector('[data-shelf-remove="o2"]')).toHaveFocus();
  });

  it('returns focus to the block when its context menu closes', () => {
    installViewport(1366);
    seedThree();
    renderPanel();
    fireEvent.contextMenu(block('90000002'));
    expect(screen.getByRole('menuitem', { name: /รายละเอียด/ })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(block('90000002')).toHaveFocus();
  });
});

describe('PlannerPanel stats bar', () => {
  /** A Monday section that clashes with nothing, then two Wednesday sections that clash. */
  function seedClash(): void {
    const entry = (
      teachTableId: string,
      subjectId: string,
      meeting: Meeting,
    ): PlanEntry =>
      makePlanEntry({
        snapshot: makeSnapshot({
          teachTableId,
          subjectId,
          section: '1',
          meetings: [meeting],
        }),
      });
    seed([
      entry(
        'a1',
        '90000001',
        makeMeeting({ day: 1, startMin: 540, endMin: 600 }),
      ),
      entry(
        'c2',
        '90000003',
        makeMeeting({ day: 3, startMin: 660, endMin: 720 }),
      ),
      entry(
        'c1',
        '90000002',
        makeMeeting({ day: 3, startMin: 600, endMin: 720 }),
      ),
    ]);
  }

  function stats(): HTMLElement {
    return screen.getByRole('group', { name: 'สรุปตาราง' });
  }

  it('sums the plan under the selected view as under the timetable', () => {
    installViewport(1366);
    seedTwoSubjects();
    renderPanel();
    expect(stats()).toHaveTextContent('ไม่มีรายการชนกัน');
    fireEvent.click(screen.getByRole('tab', { name: 'วิชาที่เลือก (2)' }));
    expect(stats()).toBeInTheDocument();
  });

  it('ends the bar with the verification status and its check again action', () => {
    installViewport(1366);
    act(() => {
      seedActivePlan(
        [makePlanEntry({ lastVerifiedAt: new Date().toISOString() })],
        { id: 'p1' },
      );
    });
    renderPanel();
    expect(stats()).toHaveTextContent(/ตรวจสอบแล้ว \d\d:\d\d/);
    expect(
      within(stats()).getByRole('button', { name: 'ตรวจสอบอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('moves the verification status to the preview toolbar, outside the poster', () => {
    installViewport(1366);
    act(() => {
      seedActivePlan([makePlanEntry()], { id: 'p1' });
      revalidationStore
        .getState()
        .setRun('p1', { status: 'offline', report: null });
      uiStore.getState().setViewMode('preview');
    });
    const { container } = renderPanel();
    const offline = 'ยังตรวจสอบไม่ได้ แสดงข้อมูลที่บันทึกไว้';
    expect(
      within(screen.getByRole('toolbar')).getByText(offline),
    ).toBeInTheDocument();
    for (const poster of container.querySelectorAll('.kcp-poster')) {
      expect(poster).not.toHaveTextContent(offline);
    }
  });

  it('renders no stats bar in preview or for an empty plan', () => {
    renderPanel();
    expect(screen.queryByRole('group', { name: 'สรุปตาราง' })).toBeNull();
    seedTwoSubjects();
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    expect(screen.queryByRole('group', { name: 'สรุปตาราง' })).toBeNull();
  });

  it('focuses the first clashing block in time order from the clash button', () => {
    Element.prototype.scrollIntoView = vi.fn();
    installViewport(1366);
    seedClash();
    renderPanel();
    fireEvent.click(
      within(stats()).getByRole('button', { name: 'ชนกัน 1 รายการ' }),
    );
    const first = document.querySelector<HTMLElement>(
      '[data-teach-table-id="c1"][data-block-order]',
    );
    expect(first).toHaveFocus();
    expect(first).toHaveClass('kcp-locate');
  });

  it('shows the day of the clash in the day view before focusing its block', () => {
    Element.prototype.scrollIntoView = vi.fn();
    installViewport(390);
    seedClash();
    renderPanel();
    // The day view opens on Monday, the first day with a class, where nothing clashes.
    expect(
      document.querySelector('[data-teach-table-id="c1"][data-block-order]'),
    ).toBeNull();
    fireEvent.click(
      within(stats()).getByRole('button', { name: 'ชนกัน 1 รายการ' }),
    );
    expect(screen.getByRole('radio', { name: /^วันพุธ/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      document.querySelector('[data-teach-table-id="c1"][data-block-order]'),
    ).toHaveFocus();
  });

  it('shows the timetable first when the clash button is pressed from the selected view', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    installViewport(1366);
    seedClash();
    act(() => {
      uiStore.getState().setPlanView('selected');
    });
    renderPanel();
    fireEvent.click(
      within(stats()).getByRole('button', { name: 'ชนกัน 1 รายการ' }),
    );
    expect(uiStore.getState().planView).toBe('timetable');
    await waitFor(() => {
      expect(
        document.querySelector('[data-teach-table-id="c1"][data-block-order]'),
      ).toHaveFocus();
    });
  });
});
