import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { planStore } from '@/features/plans/planStore';
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
import { dragStore } from './dragStore';
import { PlannerPanel } from './PlannerPanel';

// The panel always renders inside the search deps provider in the app; the banner
// reads it for the manual refresh send.
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
  });
});

describe('PlannerPanel', () => {
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
