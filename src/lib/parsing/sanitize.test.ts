import { describe, it, expect, vi } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import { sanitizeTextToLines, sanitizeToLines } from './sanitize';

interface CapturedRow {
  teach_table_id: string;
  teacher_list_th: string;
  teacher_list_en: string;
  rules_th: string;
  rules_en: string;
  remark: string;
}

// The rows are read straight from the committed captures, so every case below runs
// against text the live API returned rather than a hand written copy of it. The
// schema tests already validate the capture shape, so the cast only names the
// fields read here.
function captureRows(name: string): CapturedRow[] {
  const groups = loadFixture(name) as {
    teachtable: { data: CapturedRow[] }[];
  }[];
  return groups.flatMap((group) =>
    group.teachtable.flatMap((heading) => heading.data),
  );
}

function captureRow(name: string, teachTableId: string): CapturedRow {
  const row = captureRows(name).find(
    (candidate) => candidate.teach_table_id === teachTableId,
  );
  if (row === undefined) {
    throw new Error(`row ${teachTableId} not found in ${name}`);
  }
  return row;
}

const TEACH_TABLE_CAPTURES = [
  'teach-table.by_class.capture.json',
  'teach-table.by_subject_id.capture.json',
  'teach-table.by_subject_owner_id-32.capture.json',
  'teach-table.multi-meeting.capture.json',
  'teach-table.with-exams.capture.json',
];

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
    expect(sanitizeToLines('<div>safe</div><script>value=1</script>')).toEqual([
      'safe',
    ]);
  });

  it('keeps the dual degree and international qualifiers in both locales', () => {
    // Section 96642011/101 restricts enrolment to the dual degree international
    // program, which only the bracketed qualifiers distinguish.
    const row = captureRow('teach-table.with-exams.capture.json', '136656');
    expect(sanitizeToLines(row.rules_th)).toEqual([
      'เฉพาะคณะวิศวกรรมศาสตร์',
      'เฉพาะสาขาเทคโนโลยีวัสดุชาญฉลาดและหุ่นยนต์และปัญญาประดิษฐ์ <สองปริญญา><หลักสูตรนานาชาติ> (นน.)',
      'เฉพาะสาขาเทคโนโลยีวัสดุชาญฉลาดและหุ่นยนต์และปัญญาประดิษฐ์ <สองปริญญา><หลักสูตรนานาชาติ> ()',
    ]);
    expect(sanitizeToLines(row.rules_en)).toEqual([
      'Only School of Engineering',
      'Only Curriculum Smart Materials Technology and Robotics and AI <Dual Degree> <International Program> (NNT)',
      'Only Curriculum Smart Materials Technology and Robotics and AI Engineering <Dual Degree> <International Program> ()',
    ]);
  });

  it('strips known elements with attributes and keeps unknown bracketed text', () => {
    expect(
      sanitizeToLines(
        '<div class="x"><font color="red"><b>ปิด</b></font> <Dual Degree></div>',
      ),
    ).toEqual(['ปิด <Dual Degree>']);
  });

  it('drops script and style bodies along with their tags', () => {
    expect(
      sanitizeToLines(
        '<div>A<script type="text/javascript">alert(1)</script></div>' +
          '<div><style>div{color:red}</style>B</div>',
      ),
    ).toEqual(['A', 'B']);
    expect(sanitizeToLines('<div>A</div><script>alert(1)')).toEqual(['A']);
  });

  it('removes an image tag whose quoted attribute hides a closing bracket', () => {
    const lines = sanitizeToLines(
      '<div>A<img src="x" onerror="alert(1) > 0"></div>',
    );
    expect(lines).toEqual(['A']);
  });

  it('reads the same teacher names from every capture', () => {
    // The captures wrap each teacher in a bare <div>, so every name is that div
    // body trimmed, with no markup left behind.
    for (const name of TEACH_TABLE_CAPTURES) {
      for (const row of captureRows(name)) {
        for (const raw of [row.teacher_list_th, row.teacher_list_en]) {
          const bodies = [...raw.matchAll(/<div>(.*?)<\/div>/g)]
            .map((match) => (match[1] ?? '').trim())
            .filter((body) => body.length > 0);
          expect(sanitizeToLines(raw)).toEqual(bodies);
        }
      }
    }
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

describe('sanitizeTextToLines', () => {
  it('keeps the remark text that sits before its markup wrapper', () => {
    // Section 90641009/942 appends a closed notice in a div after plain text.
    const row = captureRow('teach-table.with-exams.capture.json', '134426');
    const lines = sanitizeTextToLines(row.remark);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^วิชาบังคับภาษา: การจัดการสมาร์ตฟาร์ม/);
    expect(lines[0]).toMatch(/วิศวกรรมออโตเมชัน ปี2,$/);
    expect(lines[1]).toBe('(รายวิชาปิด/Course Closed)');
    expect(lines.join('\n')).not.toMatch(/[<>]/);
  });

  it('leaves every plain remark in the captures as written', () => {
    for (const name of TEACH_TABLE_CAPTURES) {
      for (const row of captureRows(name)) {
        if (!/[<&]/.test(row.remark)) {
          const expected = row.remark.trim();
          expect(sanitizeTextToLines(row.remark)).toEqual(
            expected.length > 0 ? [expected] : [],
          );
        }
      }
    }
  });

  it('breaks lines at block boundaries and existing line breaks', () => {
    expect(
      sanitizeTextToLines('one<br>two<br/>three<p>four</p>five\nsix'),
    ).toEqual(['one', 'two', 'three', 'four', 'five', 'six']);
  });

  it('keeps unknown bracketed text and drops executable content', () => {
    expect(
      sanitizeTextToLines(
        'Only <International Program><script>alert(1)</script>' +
          '<img src="x" onerror="alert(1)">',
      ),
    ).toEqual(['Only <International Program>']);
    expect(sanitizeTextToLines('')).toEqual([]);
  });
});
