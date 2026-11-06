import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import type { Course } from '@/lib/domain/types';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { SectionComparisonSheet } from './SectionComparisonSheet';

const t = createTranslator('th');

afterEach(cleanup);

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

/** The section codes of the body rows, read from their row headers. */
function rowCodes(): string[] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.querySelector('span')?.textContent ?? '');
}

describe('SectionComparisonSheet', () => {
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
    // The trap wraps Tab from its last stop, so the scroller must be that stop for a
    // keyboard user to reach it after the sort control.
    scroller.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(
      screen.getByRole('button', { name: 'ปิดการเปรียบเทียบ' }),
    ).toHaveFocus();
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
