import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { compareSections } from '@/lib/catalog/compareSections';
import type { Course } from '@/lib/domain/types';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { ComparisonTransposed, transposedWidth } from './ComparisonTransposed';

const t = createTranslator('th');

afterEach(cleanup);

const THREE_SECTIONS = makeCourse({
  sections: [
    makeSection({ teachTableId: 'a', section: '901' }),
    makeSection({
      teachTableId: 'b',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    }),
    makeSection({
      teachTableId: 'c',
      section: '903',
      isClosed: true,
      meetings: [makeMeeting({ day: 4 })],
    }),
  ],
});

function renderTransposed(course: Course) {
  const onAdd = vi.fn();
  const rows = compareSections(course, [], undefined, {
    onlyAddable: false,
    sort: 'start',
  });
  render(
    <ComparisonTransposed
      rows={rows}
      title="เปรียบเทียบ"
      locale="th"
      t={t}
      blockedId={null}
      scrollerRef={createRef<HTMLDivElement>()}
      onAdd={onAdd}
      onSwitchTerm={() => undefined}
    />,
  );
  return { onAdd };
}

describe('ComparisonTransposed', () => {
  it('heads a column per section and a row per field', () => {
    renderTransposed(THREE_SECTIONS);
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((head) => head.querySelector('span')?.textContent),
    ).toEqual(['901', '902', '903']);
    for (const head of within(table).getAllByRole('columnheader')) {
      expect(head).toHaveAttribute('scope', 'col');
      expect(head).toHaveClass('sticky', 'top-0');
    }
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((head) => head.textContent),
    ).toEqual([
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
  });

  it('pins the field column and the corner while the sections scroll', () => {
    renderTransposed(THREE_SECTIONS);
    const [corner, ...fields] = within(screen.getByRole('table')).getAllByRole(
      'rowheader',
    );
    expect(corner).toHaveClass('sticky', 'top-0', 'left-0', 'z-20');
    for (const field of fields) {
      expect(field).toHaveClass('sticky', 'left-0');
    }
    expect(screen.getByRole('region', { name: 'เปรียบเทียบ' })).toHaveClass(
      'overflow-auto',
      'snap-x',
    );
  });

  it('reads each field down its section column and adds from the last row', () => {
    const { onAdd } = renderTransposed(THREE_SECTIONS);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const status = rows.find((row) =>
      within(row).queryByRole('rowheader', { name: 'สถานะ' }),
    );
    if (status === undefined) throw new Error('no status row');
    const cells = within(status).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      'เพิ่มได้',
      'เพิ่มได้',
      'ปิด',
    ]);
    const addRow = rows[rows.length - 1];
    if (addRow === undefined) throw new Error('no add row');
    expect(within(addRow).getAllByRole('cell')[2]).toHaveTextContent(
      'เพิ่มไม่ได้',
    );
    fireEvent.click(
      within(addRow).getByRole('button', {
        name: 'เพิ่ม 90000001 กลุ่มเรียน 902',
      }),
    );
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ teachTableId: 'b' }),
    );
  });

  it('has no serious accessibility violations', async () => {
    renderTransposed(THREE_SECTIONS);
    await expectNoSeriousA11yViolations(screen.getByRole('region'));
  });
});

describe('transposedWidth', () => {
  it('gives two sections the width beside the field column', () => {
    expect(transposedWidth(2)).toBe('calc(6rem + 2 * (100% - 6rem) / 2)');
  });

  it('runs a third section past the edge and lets one section fill both', () => {
    expect(transposedWidth(3)).toBe('calc(6rem + 3 * (100% - 6rem) / 2)');
    expect(transposedWidth(1)).toBe('calc(6rem + 2 * (100% - 6rem) / 2)');
  });
});
