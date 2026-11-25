import { describe, expect, it } from 'vitest';
import { startsWithTyped } from './typeAhead';

describe('startsWithTyped', () => {
  it('matches the first character of a name', () => {
    expect(startsWithTyped('ซ่อนในหน้านี้', 'ซ')).toBe(true);
    expect(startsWithTyped('open the planner', 'o')).toBe(true);
    expect(startsWithTyped('open the planner', 'p')).toBe(false);
  });

  it('matches the consonant after a Thai leading vowel, and the vowel itself', () => {
    expect(startsWithTyped('เปิดตารางเรียน', 'ป')).toBe(true);
    expect(startsWithTyped('เพิ่มให้ทุกวิชา', 'พ')).toBe(true);
    expect(startsWithTyped('เปิดตารางเรียน', 'เ')).toBe(true);
    expect(startsWithTyped('ใช้ปุ่มเพิ่มให้', 'ช')).toBe(true);
    expect(startsWithTyped('เปิดตารางเรียน', 'พ')).toBe(false);
  });
});
