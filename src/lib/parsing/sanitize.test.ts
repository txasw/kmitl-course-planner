import { describe, it, expect, vi } from 'vitest';
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

  it('decodes named, decimal, and hex entities to their text', () => {
    expect(sanitizeToLines('<div>A &amp; B</div>')).toEqual(['A & B']);
    // Thai character ko kai as a decimal and a hex numeric entity.
    expect(sanitizeToLines('<div>&#3585;</div>')).toEqual(['ก']);
    expect(sanitizeToLines('<div>&#x0E01;</div>')).toEqual(['ก']);
  });

  it('leaves an unknown entity untouched', () => {
    expect(sanitizeToLines('<div>a &unknownentity; b</div>')).toEqual([
      'a &unknownentity; b',
    ]);
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

  it('parses without DOMParser, as in the service worker', () => {
    // Normalization runs in the worker, which has no DOM. Removing DOMParser
    // must not break sanitizing.
    vi.stubGlobal('DOMParser', undefined);
    try {
      expect(sanitizeToLines('<div>อ. A</div><div>B</div>')).toEqual([
        'อ. A',
        'B',
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
