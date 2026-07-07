import { describe, it, expect } from 'vitest';
import { sanitizeToLines } from './sanitize';

describe('sanitizeToLines', () => {
  it('reads a single wrapped teacher name', () => {
    expect(sanitizeToLines('<div>อ. ภาณุวัฒน์ จุทอง</div>')).toEqual([
      'อ. ภาณุวัฒน์ จุทอง',
    ]);
  });

  it('splits concatenated div wrappers into one line each', () => {
    const raw =
      '<div>อ. สุรชาติ กมลดิลก</div><div>ผศ. ดร. กีรยุทธ์ ศรีนวลจันทร์</div>' +
      '<div>ดร. วิฑูรย์ ยินดีสุข</div><div>ผศ. ดร. เมตยา กิติวรรณ</div>';
    expect(sanitizeToLines(raw)).toEqual([
      'อ. สุรชาติ กมลดิลก',
      'ผศ. ดร. กีรยุทธ์ ศรีนวลจันทร์',
      'ดร. วิฑูรย์ ยินดีสุข',
      'ผศ. ดร. เมตยา กิติวรรณ',
    ]);
  });

  it('decodes HTML entities to their text', () => {
    expect(sanitizeToLines('<div>A &amp; B</div>')).toEqual(['A & B']);
  });

  it('treats a plain string with no wrapper as one line', () => {
    expect(sanitizeToLines('Lecturer Wanlop Ruchikachorn')).toEqual([
      'Lecturer Wanlop Ruchikachorn',
    ]);
  });

  it('drops empty and whitespace only entries', () => {
    expect(sanitizeToLines('<div>  </div><div>x</div><div></div>')).toEqual([
      'x',
    ]);
    expect(sanitizeToLines('')).toEqual([]);
    expect(sanitizeToLines('   ')).toEqual([]);
  });

  it('does not execute or expand markup, only reads text', () => {
    // The script text survives as inert text content and nothing runs.
    expect(sanitizeToLines('<div>safe</div><script>value=1</script>')).toEqual([
      'safe',
    ]);
  });
});
