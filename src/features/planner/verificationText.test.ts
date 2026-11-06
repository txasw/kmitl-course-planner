import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import type { RevalidationRun } from '@/features/plans/revalidationStore';
import { checkedTime, verificationText } from './verificationText';

const th = createTranslator('th');
const en = createTranslator('en');

// Local times, so the clock reads the same in any test time zone.
const NOW = new Date(2026, 10, 6, 15, 0);
const TODAY = new Date(2026, 10, 6, 14, 32).toISOString();
const asOf = { kind: 'asOf', at: TODAY } as const;

function run(
  status: RevalidationRun['status'],
  changed = 0,
  missing = 0,
): RevalidationRun {
  return {
    status,
    report:
      status === 'running' || status === 'offline'
        ? null
        : {
            summary: {
              total: 3,
              unchanged: 3 - changed - missing,
              changed,
              missing,
            },
            entries: [],
            termFindings: [],
          },
  };
}

describe('checkedTime', () => {
  it('reads the clock time for a check today', () => {
    expect(checkedTime(TODAY, NOW, th)).toBe('14:32');
  });

  it('reads the date and the time for a check on another day', () => {
    const earlier = new Date(2026, 10, 4, 9, 5).toISOString();
    expect(checkedTime(earlier, NOW, th)).toBe('4 พ.ย. 2569 09:05');
  });
});

describe('verificationText', () => {
  it('says a check is running', () => {
    expect(verificationText(run('running'), asOf, NOW, th)).toEqual({
      tone: 'checking',
      text: 'กำลังตรวจสอบข้อมูล',
    });
  });

  it('states the checked time of a clean run', () => {
    expect(verificationText(run('done'), asOf, NOW, th)).toEqual({
      tone: 'ok',
      text: 'ตรวจสอบแล้ว 14:32',
    });
    expect(verificationText(run('done'), asOf, NOW, en).text).toBe(
      'Checked at 14:32',
    );
  });

  it('states the checked time with no run in this session', () => {
    expect(verificationText(null, asOf, NOW, th)).toEqual({
      tone: 'ok',
      text: 'ตรวจสอบแล้ว 14:32',
    });
  });

  it('adds the changed and missing counts a run found', () => {
    expect(verificationText(run('done', 1, 2), asOf, NOW, th)).toEqual({
      tone: 'changed',
      text: 'ตรวจสอบแล้ว 14:32 เปลี่ยน 1 ไม่พบ 2',
    });
  });

  it('separates the parts with commas in English', () => {
    expect(verificationText(run('partial', 1, 2), asOf, NOW, en).text).toBe(
      'Checked at 14:32, 1 changed, 2 missing, some could not be checked',
    );
  });

  it('keeps the partial warning and its retry for a plan never verified before', () => {
    expect(
      verificationText(run('partial'), { kind: 'unverified' }, NOW, th),
    ).toEqual({
      tone: 'warn',
      text: 'ยังไม่ได้ตรวจสอบ บางรายการตรวจไม่ได้',
    });
  });

  it('warns that an offline run shows the saved data', () => {
    expect(verificationText(run('offline'), asOf, NOW, th)).toEqual({
      tone: 'warn',
      text: 'ยังตรวจสอบไม่ได้ แสดงข้อมูลที่บันทึกไว้',
    });
  });

  it('warns that a partial run left some entries unchecked', () => {
    expect(verificationText(run('partial', 1), asOf, NOW, th)).toEqual({
      tone: 'warn',
      text: 'ตรวจสอบแล้ว 14:32 เปลี่ยน 1 บางรายการตรวจไม่ได้',
    });
  });

  it('says the plan is not checked yet when no entry was verified', () => {
    expect(verificationText(null, { kind: 'unverified' }, NOW, th)).toEqual({
      tone: 'none',
      text: 'ยังไม่ได้ตรวจสอบ',
    });
  });
});
