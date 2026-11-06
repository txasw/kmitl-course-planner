import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { PlanEntry, VerifyStatus } from '@/lib/domain/plan';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  SelectedCoursesList,
  groupEntriesBySubject,
} from './SelectedCoursesList';

const t = createTranslator('th');

function entry(
  teachTableId: string,
  subjectId: string,
  section: string,
  overrides: { verifyStatus?: VerifyStatus; rulesTh?: string } = {},
): PlanEntry {
  const base = makeSection({
    teachTableId,
    subjectId,
    section,
    rulesTh: overrides.rulesTh ?? '',
  });
  return makePlanEntry({
    snapshot: makeSnapshot({
      ...base,
      subjectMeta: {
        subjectId,
        nameTh: `วิชา ${subjectId}`,
        nameEn: `Subject ${subjectId}`,
        credit: 3,
        creditStr: '3(2-2-5)',
      },
    }),
    verifyStatus: overrides.verifyStatus ?? 'verified',
  });
}

const NONE = new Set<string>();

// Holds the entries in state, so a removal re-renders the list the way the plan store
// does in the app and the focus hand off is observed against the updated list.
function Harness({ initial }: { initial: PlanEntry[] }) {
  const [entries, setEntries] = useState(initial);
  return (
    <SelectedCoursesList
      groups={groupEntriesBySubject(entries)}
      locale="th"
      t={t}
      onRemove={(id) => {
        setEntries((current) => current.filter((e) => e.teachTableId !== id));
      }}
      conflictIds={NONE}
      examConflictIds={NONE}
    />
  );
}

function cards(): HTMLElement[] {
  const list = screen.getByRole('list', { name: 'วิชาที่เลือก' });
  return within(list)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === list);
}

afterEach(cleanup);

describe('groupEntriesBySubject', () => {
  it('orders subjects by id and each subject by section code', () => {
    const groups = groupEntriesBySubject([
      entry('b2', '90000002', '12'),
      entry('a1', '90000001', '901'),
      entry('b1', '90000002', '2'),
    ]);
    expect(groups.map((group) => group.subjectId)).toEqual([
      '90000001',
      '90000002',
    ]);
    expect(groups[1]?.entries.map((e) => e.snapshot.section)).toEqual([
      '2',
      '12',
    ]);
  });
});

describe('SelectedCoursesList', () => {
  it('renders one card per subject with the pair halves inside it', () => {
    render(
      <Harness
        initial={[
          entry('p1', '90000001', '901'),
          entry('p2', '90000001', '902'),
          entry('s1', '90000002', '1'),
        ]}
      />,
    );
    const [first, second] = cards();
    expect(cards()).toHaveLength(2);
    expect(
      within(first ?? document.body).getByRole('heading', { level: 4 }),
    ).toHaveTextContent('90000001 วิชา 90000001');
    expect(first).toHaveTextContent('กลุ่มเรียน 901');
    expect(first).toHaveTextContent('กลุ่มเรียน 902');
    expect(first).toHaveTextContent('Subject 90000001');
    expect(first).toHaveTextContent('3(2-2-5)');
    expect(second).toHaveTextContent('กลุ่มเรียน 1');
  });

  it('never uses the article role the catalog cards own', () => {
    render(<Harness initial={[entry('s1', '90000001', '1')]} />);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows the section details and the enrollment conditions', () => {
    render(
      <Harness
        initial={[
          entry('s1', '90000001', '1', { rulesTh: 'เฉพาะชั้นปีที่ 1' }),
        ]}
      />,
    );
    const [card] = cards();
    expect(card).toHaveTextContent('จันทร์');
    expect(card).toHaveTextContent('เฉพาะชั้นปีที่ 1');
  });

  it('badges a changed entry and a missing entry', () => {
    render(
      <Harness
        initial={[
          entry('c1', '90000001', '1', { verifyStatus: 'changed' }),
          entry('m1', '90000002', '1', { verifyStatus: 'missing' }),
          entry('v1', '90000003', '1'),
        ]}
      />,
    );
    const [changed, missing, clean] = cards();
    expect(changed).toHaveTextContent('ข้อมูลเปลี่ยน');
    expect(missing).toHaveTextContent('ไม่พบในระบบแล้ว');
    expect(clean).not.toHaveTextContent('ข้อมูลเปลี่ยน');
    expect(clean).not.toHaveTextContent('ไม่พบในระบบแล้ว');
  });

  it('badges a time conflict and an exam overlap from the plan', () => {
    render(
      <SelectedCoursesList
        groups={groupEntriesBySubject([
          entry('t1', '90000001', '1'),
          entry('e1', '90000002', '1'),
        ])}
        locale="th"
        t={t}
        onRemove={vi.fn()}
        conflictIds={new Set(['t1'])}
        examConflictIds={new Set(['e1'])}
      />,
    );
    const [timeConflict, examConflict] = cards();
    expect(timeConflict).toHaveTextContent('เวลาชนกัน');
    expect(examConflict).toHaveTextContent('เวลาสอบชนกัน');
  });

  it('removes every section of the subject from its remove control', () => {
    const onRemove = vi.fn();
    render(
      <SelectedCoursesList
        groups={groupEntriesBySubject([
          entry('p1', '90000001', '901'),
          entry('p2', '90000001', '902'),
        ])}
        locale="th"
        t={t}
        onRemove={onRemove}
        conflictIds={NONE}
        examConflictIds={NONE}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'นำออก 90000001 กลุ่มเรียน 901 902',
      }),
    );
    expect(onRemove.mock.calls).toEqual([['p1'], ['p2']]);
  });

  it('moves focus to the next card after a removal', () => {
    render(
      <Harness
        initial={[
          entry('a1', '90000001', '1'),
          entry('b1', '90000002', '1'),
          entry('c1', '90000003', '1'),
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'นำออก 90000002 กลุ่มเรียน 1' }),
    );
    expect(cards()).toHaveLength(2);
    expect(
      screen.getByRole('heading', { level: 4, name: '90000003 วิชา 90000003' }),
    ).toHaveFocus();
  });

  it('moves focus to the list heading when the last card is removed', () => {
    render(
      <Harness
        initial={[entry('a1', '90000001', '1'), entry('b1', '90000002', '1')]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'นำออก 90000002 กลุ่มเรียน 1' }),
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'วิชาที่เลือก' }),
    ).toHaveFocus();
  });

  it('keeps the list heading and shows the empty state once nothing is left', () => {
    render(<Harness initial={[entry('a1', '90000001', '1')]} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'นำออก 90000001 กลุ่มเรียน 1' }),
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'วิชาที่เลือก' }),
    ).toHaveFocus();
    expect(screen.getByText('ยังไม่ได้เลือกรายวิชา')).toBeVisible();
  });
});
