import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import type { Section } from '@/lib/domain/types';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { SectionDetailList } from './SectionDetailList';

const th = createTranslator('th');
const en = createTranslator('en');

afterEach(() => {
  cleanup();
});

/** The value cells of the row whose label is `label`. */
function rowValues(label: string): string[] {
  const term = screen.getByText(label, { selector: 'dt' });
  const row = term.parentElement;
  if (row === null) {
    throw new Error(`no row for ${label}`);
  }
  return Array.from(row.querySelectorAll('dd')).map((node) => node.textContent);
}

// 01006030 section 34 in the multi meeting capture meets twice on Monday in ECC-608: its
// primary meeting from 13:00 and the extra teachtime_str meeting from 14:45.
function multiMeetingSection(): Section {
  const result = normalizeTeachTable(
    loadFixture('teach-table.multi-meeting.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  const section = result.value.courses
    .find((course) => course.subjectId === '01006030')
    ?.sections.find((item) => item.section === '34');
  if (section === undefined) {
    throw new Error('fixture is missing 01006030 section 34');
  }
  return section;
}

describe('SectionDetailList', () => {
  it('lists every meeting with its full day, time, and place', () => {
    render(
      <SectionDetailList
        section={multiMeetingSection()}
        creditStr="3(3-0-6)"
        density="full"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('เวลาเรียน')).toEqual([
      'วันจันทร์ 13:00-14:30ECC ECC-608',
      'วันจันทร์ 14:45-16:15ECC ECC-608',
    ]);
  });

  it('shows the kind with the credit string and the instructors under the host term', () => {
    render(
      <SectionDetailList
        section={makeSection({
          kind: 'practice',
          teachersTh: ['อ. หนึ่ง', 'อ. สอง'],
        })}
        creditStr="3(2-2-5)"
        density="compact"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('ประเภทและหน่วยกิต')).toEqual(['ปฏิบัติ 3(2-2-5)']);
    expect(rowValues('อาจารย์ผู้สอน')).toEqual(['อ. หนึ่ง', 'อ. สอง']);
    expect(screen.getByText('อ. หนึ่ง')).toHaveAttribute('lang', 'th');
  });

  // The teacher list is read from the API's div wrappers without deduplication, so a
  // name the API repeats must still render once per wrapper rather than collide on a key.
  it('keeps every instructor line when the API repeats a name', () => {
    // React reports a duplicate key through console.error.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    render(
      <SectionDetailList
        section={makeSection({ teachersTh: ['อ. หนึ่ง', 'อ. หนึ่ง'] })}
        creditStr="3(3-0-6)"
        density="compact"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('อาจารย์ผู้สอน')).toEqual(['อ. หนึ่ง', 'อ. หนึ่ง']);
    const errorCalls = consoleError.mock.calls.length;
    consoleError.mockRestore();
    expect(errorCalls).toBe(0);
  });

  it('falls back to the other language field and marks its language', () => {
    render(
      <SectionDetailList
        section={makeSection({ teachersTh: ['อ. หนึ่ง'], teachersEn: [] })}
        creditStr="3(3-0-6)"
        density="compact"
        locale="en"
        t={en}
      />,
    );
    expect(screen.getByText('อ. หนึ่ง')).toHaveAttribute('lang', 'th');
  });

  it('reads the seats through the shared seat line and the host counts', () => {
    render(
      <SectionDetailList
        section={makeSection({
          seats: { limit: 45, preCount: 0, queueLeft: 0, enrolled: 33 },
        })}
        creditStr="3(3-0-6)"
        density="compact"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('ที่นั่ง')).toEqual([
      'ว่าง 12 จาก 45รับ 45 ลง 33 ล่วงหน้า 0 คิว 0',
    ]);
  });

  it('states pre registrations beyond the capacity in the seats row', () => {
    render(
      <SectionDetailList
        section={makeSection({
          seats: { limit: 45, preCount: 171, queueLeft: 83, enrolled: 'full' },
        })}
        creditStr="3(3-0-6)"
        density="full"
        locale="en"
        t={en}
      />,
    );
    expect(rowValues('Seats')).toEqual([
      'Full, cannot be addedCapacity 45 Pre registered 171 Queue 83Pre registrations exceed capacity',
    ]);
  });

  it('shows both exam windows in the Buddhist year', () => {
    render(
      <SectionDetailList
        section={makeSection({
          exam: {
            midterm: {
              start: '2026-08-21 09:00:00',
              end: '2026-08-21 12:00:00',
            },
            final: { start: '2026-10-05 13:00:00', end: '2026-10-05 16:00:00' },
          },
        })}
        creditStr="3(3-0-6)"
        density="compact"
        locale="en"
        t={en}
      />,
    );
    expect(rowValues('Midterm')).toEqual(['21 Aug 2569 09:00-12:00']);
    expect(rowValues('Final')).toEqual(['5 Oct 2569 13:00-16:00']);
    expect(
      screen.queryByText('Arranged by instructor'),
    ).not.toBeInTheDocument();
  });

  it('reads as arranged by the instructor when both windows are absent', () => {
    render(
      <SectionDetailList
        section={makeSection({ exam: {} })}
        creditStr="3(3-0-6)"
        density="compact"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('การสอบ')).toEqual(['จัดสอบเอง']);
    expect(screen.queryByText('สอบกลางภาค')).not.toBeInTheDocument();
  });

  it('states that an unscheduled section has no class time', () => {
    render(
      <SectionDetailList
        section={makeSection({ meetings: [] })}
        creditStr="3(3-0-6)"
        density="compact"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('เวลาเรียน')).toEqual(['ไม่มีคาบเรียน']);
  });

  it('adds the exam detail, conditions, remark, and last check in full density', () => {
    const section = makeSection({
      meetings: [makeMeeting({ building: '', room: '' })],
      exam: { note: 'Take home exam' },
      rulesTh: 'เฉพาะชั้นปี 1\nเฉพาะหลักสูตรนานาชาติ',
      remark: 'เปิดสอนร่วมกับคณะอื่น',
    });
    const { rerender } = render(
      <SectionDetailList
        section={section}
        creditStr="3(3-0-6)"
        density="full"
        locale="th"
        t={th}
        lastVerifiedAt={new Date(2026, 10, 6, 8, 5).toISOString()}
      />,
    );
    expect(rowValues('รายละเอียดสอบ')).toEqual(['Take home exam']);
    expect(rowValues('เงื่อนไข')).toEqual([
      'เฉพาะชั้นปี 1',
      'เฉพาะหลักสูตรนานาชาติ',
    ]);
    expect(rowValues('หมายเหตุ')).toEqual(['เปิดสอนร่วมกับคณะอื่น']);
    expect(rowValues('ตรวจสอบล่าสุด')).toEqual(['6 พ.ย. 2569 08:05']);

    rerender(
      <SectionDetailList
        section={section}
        creditStr="3(3-0-6)"
        density="compact"
        locale="th"
        t={th}
        lastVerifiedAt={new Date(2026, 10, 6, 8, 5).toISOString()}
      />,
    );
    for (const label of [
      'รายละเอียดสอบ',
      'เงื่อนไข',
      'หมายเหตุ',
      'ตรวจสอบล่าสุด',
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('lists every condition in the warn tone, falling back to the other language', () => {
    render(
      <SectionDetailList
        section={makeSection({
          rulesTh: '',
          rulesEn:
            'Only School of Engineering\nOnly Curriculum AI <Dual Degree> <International Program>',
        })}
        creditStr="3(3-0-6)"
        density="full"
        locale="th"
        t={th}
      />,
    );
    expect(rowValues('เงื่อนไข')).toEqual([
      'Only School of Engineering',
      'Only Curriculum AI <Dual Degree> <International Program>',
    ]);
    const term = screen.getByText('เงื่อนไข', { selector: 'dt' });
    expect(term.className).toContain('text-warn');
    for (const value of term.parentElement?.querySelectorAll('dd') ?? []) {
      expect(value).toHaveAttribute('lang', 'en');
      expect(value.className).toContain('text-warn');
    }
  });

  it('omits the last check before the first verification', () => {
    render(
      <SectionDetailList
        section={makeSection()}
        creditStr="3(3-0-6)"
        density="full"
        locale="th"
        t={th}
        lastVerifiedAt={null}
      />,
    );
    expect(screen.getByText('เวลาเรียน')).toBeInTheDocument();
    expect(screen.queryByText('ตรวจสอบล่าสุด')).not.toBeInTheDocument();
  });
});
