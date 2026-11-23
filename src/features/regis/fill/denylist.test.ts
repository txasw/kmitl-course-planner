import { describe, expect, it } from 'vitest';
import { isDeniedLabel } from './denylist';

// The denylist holds every clickable label of the tested host build in both languages and
// matches only the target's own text, exactly.

describe('isDeniedLabel', () => {
  it.each([
    'ดำเนินการต่อ',
    'Continue',
    'Continuous',
    'ยืนยัน',
    'Confirm',
    'กลับไปดูข้อมูล',
    'Back',
    'ย้อนกลับ',
    'ตกลง',
    'OK',
    'ยกเลิก',
    'Cancel',
    'ถอน',
    'Withdraw',
    'เปลี่ยน',
    'Change',
    'บันทึก',
    'Save',
    'ส่ง',
    'Submit',
    'ลงทะเบียน',
    'Register',
    'ยกเลิกคิว',
    'ปิด',
  ])('refuses %s, also with the host padding', (label) => {
    expect(isDeniedLabel(label)).toBe(true);
    expect(isDeniedLabel(`  ${label} `)).toBe(true);
  });

  it('leaves out the two labels a handle checks positively', () => {
    for (const label of ['เพิ่ม', 'Add', 'รับทราบ', 'Acknowledged']) {
      expect(isDeniedLabel(label)).toBe(false);
    }
  });

  it('never matches by substring, so course names and codes pass', () => {
    for (const text of [
      'Continuous Integration',
      'Back-end Development',
      'ยืนยันตัวตน 101',
      '901',
      '1 (วิศวกรรมคอมพิวเตอร์)',
    ]) {
      expect(isDeniedLabel(text)).toBe(false);
    }
  });
});
