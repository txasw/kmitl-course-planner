import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import type { Course } from '@/lib/domain/types';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { termFromQueryFields } from '@/lib/routing/academicTerms';
import type { TermContext } from '@/lib/planner/sectionState';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { toastStore } from '@/features/shell/toastStore';
import { dragStore } from '@/features/planner/dragStore';
import {
  planStore,
  useActivePlan,
  usePlacedSections,
} from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { loadFixture } from '../../../tests/support/fixtures';
import { installViewport } from '../../../tests/support/viewport';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { SectionComparisonSheet } from './SectionComparisonSheet';

const t = createTranslator('th');

const SEARCH_QUERY: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '90000001',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    resetPlanStore();
    searchStore.setState({ resultQuery: null, result: { status: 'idle' } });
    dragStore.setState({ blocked: null, crossTerm: null, announcement: null });
    toastStore.getState().dismiss();
  });
});

function captureCourse(): Course {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_subject_id.capture.json'),
  );
  if (!result.ok) throw new Error('fixture failed to normalize');
  const [course] = result.value.courses;
  if (course === undefined) throw new Error('fixture holds no course');
  return course;
}

// The overlay shape: the panel is the portal root the dialog renders into.
function Panel({ course, onClose }: { course: Course; onClose: () => void }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setNode}>
      <PanelPortalContext.Provider value={node}>
        {node === null ? null : (
          <SectionComparisonSheet
            course={course}
            placed={[]}
            locale="th"
            t={t}
            term={undefined}
            onClose={onClose}
          />
        )}
      </PanelPortalContext.Provider>
    </div>
  );
}

function renderSheet(course: Course) {
  const onClose = vi.fn();
  render(<Panel course={course} onClose={onClose} />);
  return { onClose };
}

// The catalog shape: the placed sections and the term follow the plan store, as the
// course card hands them on, so an add from the table changes the rows under it.
function StorePanel({ course }: { course: Course }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const placed = usePlacedSections();
  const plan = useActivePlan();
  const term: TermContext = {
    planTerm:
      plan === null ? null : { year: plan.year, semester: plan.semester },
    browsedTerm: termFromQueryFields(
      SEARCH_QUERY.selected_year,
      SEARCH_QUERY.selected_semester,
    ),
  };
  return (
    <div ref={setNode}>
      <PanelPortalContext.Provider value={node}>
        {node === null ? null : (
          <SectionComparisonSheet
            course={course}
            placed={placed}
            locale="th"
            t={t}
            term={term}
            onClose={() => undefined}
          />
        )}
      </PanelPortalContext.Provider>
    </div>
  );
}

/** Two sections of 90000001: 901 on Monday morning and 902 on Wednesday. */
const TWO_SECTIONS = makeCourse({
  sections: [
    makeSection({ teachTableId: 'a', section: '901' }),
    makeSection({
      teachTableId: 'b',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    }),
  ],
});

function renderStoreSheet(course: Course) {
  searchStore.setState({ resultQuery: SEARCH_QUERY });
  render(<StorePanel course={course} />);
}

/** The body row of a section, found by its row header code. */
function sectionRow(code: string): HTMLElement {
  const row = within(screen.getByRole('table'))
    .getAllByRole('row')
    .find(
      (node) =>
        node.querySelector('th[scope="row"] span')?.textContent === code,
    );
  if (row === undefined) throw new Error(`no row for section ${code}`);
  return row;
}

/** The add cell of a row, the last cell. */
function addCell(code: string): HTMLElement {
  const cell = sectionRow(code).lastElementChild;
  if (!(cell instanceof HTMLElement)) throw new Error('no add cell');
  return cell;
}

/** The table's own polite node, inside the dialog. */
function tableStatus(): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('status');
}

/** The section codes of the body rows, read from their row headers. */
function rowCodes(): string[] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.querySelector('span')?.textContent ?? '');
}

describe('SectionComparisonSheet', () => {
  // The table with a row per section opens from 768 px; below it is the phone sheet.
  beforeEach(() => {
    installViewport(1366);
  });

  it('lists every section of the capture in a table with scoped headers', () => {
    renderSheet(captureCourse());
    const dialog = screen.getByRole('dialog', {
      name: /เปรียบเทียบกลุ่มเรียน 90641007/,
    });
    const table = within(dialog).getByRole('table');
    const heads = within(table).getAllByRole('columnheader');
    expect(heads.map((head) => head.textContent)).toEqual([
      'กลุ่ม',
      'เวลาและสถานที่',
      'อาจารย์ผู้สอน',
      'ที่นั่ง',
      'สอบ',
      'เงื่อนไข',
      'เปิดให้อ้างอิงจากผลการค้นหานี้',
      'สถานะ',
      'เพิ่มลงตาราง',
    ]);
    for (const head of heads) {
      expect(head).toHaveAttribute('scope', 'col');
    }
    const rowHeads = within(table).getAllByRole('rowheader');
    expect(rowHeads).toHaveLength(44);
    for (const head of rowHeads) {
      expect(head).toHaveAttribute('scope', 'row');
    }
  });

  it('narrows to the addable sections and sorts by the most open seats', () => {
    renderSheet(captureCourse());
    fireEvent.click(
      screen.getByRole('switch', { name: 'เฉพาะกลุ่มที่เพิ่มได้' }),
    );
    expect(rowCodes()).toEqual(['10', '12', '13', '14', '15', '17', '704']);
    fireEvent.click(
      screen.getByRole('button', { name: 'ที่นั่งว่างมากที่สุด' }),
    );
    expect(rowCodes()).toEqual(['13', '10', '17', '14', '15', '12', '704']);
  });

  it('offers to show every section when none can be added', () => {
    const full = {
      limit: 40,
      preCount: 40,
      queueLeft: 0,
      enrolled: 'full' as const,
    };
    const course = makeCourse({
      sections: [
        makeSection({ teachTableId: 'a', section: '1', seats: full }),
        makeSection({
          teachTableId: 'b',
          section: '2',
          isClosed: true,
          meetings: [makeMeeting({ day: 3 })],
        }),
      ],
    });
    renderSheet(course);
    fireEvent.click(
      screen.getByRole('switch', { name: 'เฉพาะกลุ่มที่เพิ่มได้' }),
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('ไม่มีกลุ่มเรียนที่เพิ่มได้')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'แสดงทุกกลุ่มเรียน' }));
    expect(rowCodes()).toEqual(['1', '2']);
  });

  it('states an empty column in words and reads the row status', () => {
    const course = makeCourse({
      sections: [
        makeSection({ teachTableId: 'a', section: '1', meetings: [] }),
        makeSection({ teachTableId: 'b', section: '2', isClosed: true }),
      ],
    });
    renderSheet(course);
    // The unscheduled section sorts after the scheduled one by start.
    const [second, first] = screen.getAllByRole('row').slice(1);
    if (first === undefined || second === undefined) throw new Error('rows');
    expect(within(first).getByText('ไม่มีคาบเรียน')).toBeInTheDocument();
    expect(within(first).getAllByText('ไม่มี').length).toBeGreaterThan(0);
    expect(within(first).getByText('เพิ่มได้')).toBeInTheDocument();
    expect(within(second).getByText('ปิด')).toBeInTheDocument();
  });

  it('keeps the table scroller in the dialog tab order', () => {
    renderSheet(captureCourse());
    const scroller = screen.getByRole('region', {
      name: /เปรียบเทียบกลุ่มเรียน 90641007/,
    });
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(within(scroller).getByRole('table')).toBeInTheDocument();
    // The trap wraps Tab from its last stop, the last add button inside the scroller.
    const adds = within(scroller).getAllByRole('button', { name: /^เพิ่ม / });
    const last = adds[adds.length - 1];
    if (last === undefined) throw new Error('expected an add button');
    last.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(
      screen.getByRole('button', { name: 'ปิดการเปรียบเทียบ' }),
    ).toHaveFocus();
  });

  it('adds a section and announces it once in the table node', () => {
    seedActivePlan([]);
    renderStoreSheet(TWO_SECTIONS);
    fireEvent.click(
      within(addCell('901')).getByRole('button', {
        name: 'เพิ่ม 90000001 กลุ่มเรียน 901',
      }),
    );
    expect(planStore.getState().entries.map((e) => e.section)).toEqual(['901']);
    expect(addCell('901')).toHaveTextContent('เพิ่มแล้ว');
    expect(addCell('902')).toHaveTextContent('เพิ่มไม่ได้');
    expect(tableStatus()).toHaveTextContent(
      /^เพิ่ม 90000001 กลุ่มเรียน 901 แล้ว$/,
    );
    // The persistent regions sit under the modal, so they stay silent.
    expect(dragStore.getState().announcement).toBeNull();
    expect(toastStore.getState().toast).toBeNull();
    // The pressed button became a mark, so focus moved on to the table.
    expect(screen.getByRole('region')).toHaveFocus();
  });

  it('states a blocked add in its cell and commits nothing', () => {
    const blocker = makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: 'x',
        subjectId: '90000002',
        section: '101',
      }),
    });
    seedActivePlan([blocker]);
    renderStoreSheet(TWO_SECTIONS);
    const add = within(addCell('901')).getByRole('button', {
      name: 'เพิ่ม 90000001 กลุ่มเรียน 901',
    });
    expect(within(addCell('901')).queryByText(/ชนกับ/)).toBeNull();
    fireEvent.click(add);
    expect(planStore.getState().entries).toEqual([blocker]);
    const callout = within(addCell('901')).getByText(
      /^ชนกับ 90000002 กลุ่มเรียน 101/,
    );
    expect(add).toHaveAccessibleDescription(callout.textContent);
    expect(tableStatus()).toHaveTextContent(callout.textContent);
    expect(dragStore.getState().blocked).toBeNull();
    // The section that fits still adds, and the reason leaves with the block.
    fireEvent.click(
      within(addCell('902')).getByRole('button', {
        name: 'เพิ่ม 90000001 กลุ่มเรียน 902',
      }),
    );
    expect(planStore.getState().entries).toHaveLength(2);
    expect(within(addCell('901')).queryByText(/ชนกับ/)).toBeNull();
  });

  it('switches to a plan for the browsed term from a different term row', () => {
    seedActivePlan([], { id: 'p2', year: '2569', semester: '2' });
    renderStoreSheet(TWO_SECTIONS);
    expect(
      within(addCell('901')).queryByRole('button', { name: /^เพิ่ม / }),
    ).toBeNull();
    fireEvent.click(
      within(addCell('901')).getByRole('button', {
        name: 'สลับไปตารางภาคนี้',
      }),
    );
    const plan = planStore
      .getState()
      .plans.find((entry) => entry.id === planStore.getState().activePlanId);
    expect(plan).toMatchObject({ year: '2569', semester: '1' });
    expect(tableStatus()).toHaveTextContent('สลับไปที่ ตาราง 1/2569 แล้ว');
    expect(
      within(addCell('901')).getByRole('button', {
        name: 'เพิ่ม 90000001 กลุ่มเรียน 901',
      }),
    ).toBeInTheDocument();
  });

  it('says a full or closed section cannot be added', () => {
    seedActivePlan([]);
    renderStoreSheet(
      makeCourse({
        sections: [
          makeSection({ teachTableId: 'a', section: '901', isClosed: true }),
          makeSection({
            teachTableId: 'b',
            section: '902',
            meetings: [makeMeeting({ day: 3 })],
          }),
        ],
      }),
    );
    expect(addCell('901')).toHaveTextContent('เพิ่มไม่ได้');
    expect(within(addCell('901')).queryByRole('button')).toBeNull();
  });

  it('closes on Escape and from the close button', () => {
    const { onClose } = renderSheet(captureCourse());
    fireEvent.keyDown(screen.getByRole('table'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'ปิดการเปรียบเทียบ' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no serious accessibility violations', async () => {
    const course = makeCourse({
      sections: [
        makeSection({ teachTableId: 'a', section: '1', teachersTh: ['อ. ก'] }),
        makeSection({
          teachTableId: 'b',
          section: '2',
          rulesTh: 'เฉพาะชั้นปี 1',
        }),
      ],
    });
    renderSheet(course);
    await expectNoSeriousA11yViolations(screen.getByRole('dialog'));
  });
});

/** The section codes of the transposed table's columns, read from their headers. */
function columnCodes(): string[] {
  return within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((cell) => cell.querySelector('span > span')?.textContent ?? '');
}

/** The cell of the transposed add row under a section's column. */
function phoneAddCell(code: string): HTMLElement {
  const rows = within(screen.getByRole('table')).getAllByRole('row');
  const addRow = rows[rows.length - 1];
  if (addRow === undefined) throw new Error('no add row');
  const cell = within(addRow).getAllByRole('cell')[columnCodes().indexOf(code)];
  if (cell === undefined) throw new Error(`no add cell for ${code}`);
  return cell;
}

describe('SectionComparisonSheet below 768 px', () => {
  it('opens a full height sheet with a column per section', () => {
    installViewport(390);
    renderSheet(captureCourse());
    const dialog = screen.getByRole('dialog', {
      name: /เปรียบเทียบกลุ่มเรียน 90641007/,
    });
    expect(dialog).toHaveClass('h-dvh', 'rounded-t-kcp-sheet');
    expect(
      screen.getByRole('heading', { name: /เปรียบเทียบกลุ่มเรียน/ }),
    ).toHaveFocus();
    expect(columnCodes()).toHaveLength(44);
    const fields = within(dialog).getAllByRole('rowheader');
    expect(fields[0]).toHaveTextContent('กลุ่ม');
    expect(fields[fields.length - 1]).toHaveTextContent('เพิ่มลงตาราง');
    // The sheet body leaves the scroll to the table, so its headers stick.
    const scroller = within(dialog).getByRole('region');
    expect(scroller).toHaveClass('overflow-auto', 'flex-1');
    expect(scroller.parentElement).not.toHaveClass('overflow-y-auto');
  });

  it('turns the table at the 768 px edge', () => {
    const viewport = installViewport(767);
    renderSheet(TWO_SECTIONS);
    expect(columnCodes()).toEqual(['901', '902']);
    act(() => {
      viewport.resize(768);
    });
    expect(screen.getByRole('dialog')).toHaveClass('max-w-[64rem]');
    expect(rowCodes()).toEqual(['901', '902']);
  });

  it('adds from the add row and announces it once in the sheet node', () => {
    installViewport(390);
    seedActivePlan([]);
    renderStoreSheet(TWO_SECTIONS);
    fireEvent.click(
      within(phoneAddCell('902')).getByRole('button', {
        name: 'เพิ่ม 90000001 กลุ่มเรียน 902',
      }),
    );
    expect(planStore.getState().entries.map((e) => e.section)).toEqual(['902']);
    expect(phoneAddCell('902')).toHaveTextContent('เพิ่มแล้ว');
    expect(phoneAddCell('901')).toHaveTextContent('เพิ่มไม่ได้');
    expect(tableStatus()).toHaveTextContent(
      /^เพิ่ม 90000001 กลุ่มเรียน 902 แล้ว$/,
    );
    expect(toastStore.getState().toast).toBeNull();
    expect(screen.getByRole('region')).toHaveFocus();
  });

  it('closes on Escape', () => {
    installViewport(390);
    const { onClose } = renderSheet(TWO_SECTIONS);
    fireEvent.keyDown(screen.getByRole('table'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no serious accessibility violations', async () => {
    installViewport(390);
    renderSheet(TWO_SECTIONS);
    await expectNoSeriousA11yViolations(screen.getByRole('dialog'));
  });
});
