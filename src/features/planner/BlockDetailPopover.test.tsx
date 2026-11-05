import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import { createTranslator, type Locale } from '@/lib/i18n/t';
import type { ReconcileReport } from '@/lib/planner/revalidate';
import { planExamConflicts, type ExamOverlap } from '@/lib/planner/examOverlap';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import { buildSnapshot, type PlanEntry } from '@/lib/domain/plan';
import type { Course, Section } from '@/lib/domain/types';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { planStore } from '@/features/plans/planStore';
import { revalidationStore } from '@/features/plans/revalidationStore';
import { BlockDetailPopover } from './BlockDetailPopover';

const t = createTranslator('en');

function makeAnchor(): HTMLElement {
  const anchor = document.createElement('div');
  anchor.dataset.teachTableId = 't1';
  document.body.appendChild(anchor);
  return anchor;
}

afterEach(() => {
  cleanup();
  resetPlanStore();
  revalidationStore.setState({ runs: {} });
  document.querySelectorAll('[data-teach-table-id]').forEach((node) => {
    node.remove();
  });
});

function renderPopover(
  overrides: {
    onClose?: () => void;
    onRemove?: (id: string) => void;
    examOverlaps?: ExamOverlap[];
    teachTableId?: string;
    locale?: Locale;
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onRemove = overrides.onRemove ?? vi.fn();
  const locale = overrides.locale ?? 'en';
  const anchor = makeAnchor();
  render(
    <BlockDetailPopover
      teachTableId={overrides.teachTableId ?? 't1'}
      anchor={anchor}
      locale={locale}
      t={locale === 'en' ? t : createTranslator(locale)}
      onClose={onClose}
      onRemove={onRemove}
      examOverlaps={overrides.examOverlaps ?? []}
    />,
  );
  return { onClose, onRemove };
}

/** A plan entry for one section of a normalized capture, found by subject and section. */
function fixtureEntry(
  fixture: string,
  subjectId: string,
  sectionCode: string,
  overrides: Partial<PlanEntry> = {},
): { entry: PlanEntry; section: Section } {
  const result = normalizeTeachTable(loadFixture(fixture));
  if (!result.ok) {
    throw new Error(`${fixture} failed to normalize`);
  }
  const course: Course | undefined = result.value.courses.find(
    (item) => item.subjectId === subjectId,
  );
  const section = course?.sections.find((item) => item.section === sectionCode);
  if (course === undefined || section === undefined) {
    throw new Error(`${fixture} is missing ${subjectId} ${sectionCode}`);
  }
  const snapshot = buildSnapshot(section, {
    subjectId: course.subjectId,
    nameTh: course.nameTh,
    nameEn: course.nameEn,
    credit: course.credit,
    creditStr: course.creditStr,
  });
  return {
    entry: makePlanEntry({
      teachTableId: section.teachTableId,
      subjectId: section.subjectId,
      section: section.section,
      snapshot,
      ...overrides,
    }),
    section,
  };
}

/** The value cells of the detail row whose label is `label`. */
function rowValues(label: string): string[] {
  const row = screen.getByText(label, { selector: 'dt' }).parentElement;
  return Array.from(row?.querySelectorAll('dd') ?? []).map(
    (node) => node.textContent,
  );
}

describe('BlockDetailPopover', () => {
  it('renders the section metadata for the entry', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    renderPopover();
    expect(
      screen.getByText(
        (_, node) => node?.textContent === '90000001 Section 901',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Subject')).toHaveAttribute('lang', 'en');
  });

  it('caps its height to the available space and scrolls inside', async () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    renderPopover();
    const dialog = screen.getByRole('dialog');
    await waitFor(() => {
      expect(dialog.style.maxHeight).toMatch(/^\d+px$/);
    });
    expect(dialog).toHaveClass('kcp-scroll', 'overflow-y-auto');
  });

  it('removes through the callback and closes', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    const { onClose, onRemove } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('t1');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers acknowledge only for a changed entry and clears the status', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'changed' })]);
    });
    renderPopover();
    const acknowledge = screen.getByRole('button', { name: 'Acknowledge' });
    act(() => {
      fireEvent.click(acknowledge);
    });
    expect(planStore.getState().entries[0]?.verifyStatus).toBe('verified');
  });

  it('hides acknowledge for a verified entry', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    });
    renderPopover();
    expect(
      screen.queryByRole('button', { name: 'Acknowledge' }),
    ).not.toBeInTheDocument();
  });

  it('shows old versus new values from the active revalidation run', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'changed' })], {
        id: 'plan-1',
      });
      const report: ReconcileReport = {
        summary: { total: 1, unchanged: 0, changed: 1, missing: 0 },
        entries: [
          {
            teachTableId: 't1',
            subjectId: '90000001',
            section: '901',
            outcome: 'changed',
            changes: ['room_changed'],
            before: makeSnapshot({
              meetings: [makeMeeting({ room: 'A101', building: '' })],
            }),
            after: makeSnapshot({
              meetings: [makeMeeting({ room: 'B202', building: '' })],
            }),
          },
        ],
        termFindings: [],
      };
      revalidationStore.getState().setRun('plan-1', {
        status: 'done',
        report,
      });
    });
    renderPopover();
    expect(screen.getByText('B202')).toBeInTheDocument();
    expect(screen.getByText('A101')).toBeInTheDocument();
  });

  it('lists an exam overlap with both windows, distinct from the diff', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ verifyStatus: 'verified' })]);
    });
    renderPopover({
      examOverlaps: [
        {
          blocking: { teachTableId: 'x', subjectId: '90000009', section: '5' },
          kind: 'midterm',
          self: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
          other: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
        },
      ],
    });
    // The badge and the overlap section both name the clash.
    expect(screen.getAllByText('Exam overlap')).toHaveLength(2);
    expect(
      screen.getByRole('region', { name: 'Exam overlap' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Midterm')).toBeInTheDocument();
    expect(screen.getByText('21 Aug 2569 09:00-12:00')).toBeInTheDocument();
    expect(
      screen.getByText(/90000009 Section 5: 21 Aug 2569 11:00-13:00/),
    ).toBeInTheDocument();
  });

  // 01006030 section 34 in the multi meeting capture meets twice on Monday in ECC-608 and
  // announces both exam windows, and nothing else in the plan clashes with it.
  it('lists every meeting and the exam windows of a non overlapping entry', () => {
    const { entry } = fixtureEntry(
      'teach-table.multi-meeting.capture.json',
      '01006030',
      '34',
    );
    act(() => {
      seedActivePlan([entry]);
    });
    renderPopover({ teachTableId: entry.teachTableId });
    expect(rowValues('Class times')).toEqual([
      'Monday 13:00-14:30ECC ECC-608',
      'Monday 14:45-16:15ECC ECC-608',
    ]);
    expect(rowValues('Midterm')).toEqual(['26 Aug 2568 09:30-12:30']);
    expect(rowValues('Final')).toEqual(['21 Oct 2568 09:30-12:30']);
    expect(rowValues('Type and credits')).toEqual(['Lecture 3(3-0-6)']);
    expect(screen.queryByText('Exam overlap')).not.toBeInTheDocument();
  });

  it('reads จัดสอบเอง when both exam windows are null', () => {
    act(() => {
      seedActivePlan([makePlanEntry({ snapshot: makeSnapshot({ exam: {} }) })]);
    });
    renderPopover({ locale: 'th' });
    expect(rowValues('การสอบ')).toEqual(['จัดสอบเอง']);
  });

  it('shows the seats, conditions, remark, and the last check in full', () => {
    act(() => {
      seedActivePlan([
        makePlanEntry({
          verifyStatus: 'verified',
          lastVerifiedAt: new Date(2026, 10, 6, 8, 5).toISOString(),
          snapshot: makeSnapshot({
            seats: { limit: 45, preCount: 0, queueLeft: 0, enrolled: 33 },
            rulesEn: 'Year 1 only',
            remark: 'Shared with another faculty',
          }),
        }),
      ]);
    });
    renderPopover();
    expect(rowValues('Seats')).toEqual(['12 of 45 open']);
    expect(rowValues('Conditions')).toEqual(['Year 1 only']);
    expect(rowValues('Remark')).toEqual(['Shared with another faculty']);
    expect(rowValues('Last checked')).toEqual(['6 Nov 2569 08:05']);
  });

  // The synthetic exam overlap fixture: 90000010/901 and 90000011/901 meet on different
  // days but both sit their midterm on the morning of 21 Aug 2026.
  it('reads both labels for an entry that changed and clashes on an exam', () => {
    const placed = fixtureEntry(
      'synthetic.exam-overlap.json',
      '90000010',
      '901',
      {
        verifyStatus: 'changed',
      },
    );
    const other = fixtureEntry(
      'synthetic.exam-overlap.json',
      '90000011',
      '901',
    );
    const overlaps = planExamConflicts([placed.section, other.section]).get(
      placed.entry.teachTableId,
    );
    expect(overlaps).toHaveLength(1);
    act(() => {
      seedActivePlan([placed.entry, other.entry]);
    });
    renderPopover({
      teachTableId: placed.entry.teachTableId,
      examOverlaps: overlaps ?? [],
    });
    const badge = screen.getByText('Exam overlap Updated');
    expect(badge).toHaveClass('text-danger');
  });

  it('closes on Escape without the press reaching the overlay', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    const outer = vi.fn();
    document.body.addEventListener('keydown', outer);
    const { onClose } = renderPopover();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    document.body.removeEventListener('keydown', outer);
    expect(onClose).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it('closes when the entry leaves the plan', () => {
    act(() => {
      seedActivePlan([makePlanEntry()]);
    });
    const { onClose } = renderPopover();
    act(() => {
      planStore.setState({ entries: [] });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
