import { describe, it, expect } from 'vitest';
import {
  DEBUG_CANARY,
  MUTATION_PRESETS,
  dropTeachTime2,
  nullSubjectName,
  flipCountToNumber,
  stripTeacherHtml,
  injectUnknownField,
  corruptTimeString,
} from './mutations';

function response(): unknown {
  return [
    {
      teachtable: [
        {
          subject_type_name_th: 'empty',
          subject_type_name_en: 'empty',
          data: [],
        },
        {
          subject_type_name_th: 'g1',
          subject_type_name_en: 'g1',
          data: [
            {
              teach_table_id: 't1',
              subject_name_th: 'x',
              teach_time: '09:00:00',
              teach_time2: '12:00:00',
              teacher_list_th: '<div>A</div>',
              count: 'เต็ม/Full',
            },
          ],
        },
      ],
    },
  ];
}

// Navigate the known test response shape to the mutated row. The casts are
// confined to this test helper reading a fixture the test itself constructed.
function firstRow(value: unknown): Record<string, unknown> {
  const groups = value as { teachtable: { data: unknown[] }[] }[];
  const row = groups[0]?.teachtable[1]?.data[0];
  return row as Record<string, unknown>;
}

describe('mutation presets', () => {
  it('embeds the debug canary and exposes every preset', () => {
    expect(DEBUG_CANARY).toBe('kcp-debug-canary');
    expect(MUTATION_PRESETS).toHaveLength(6);
  });

  it('drops teach_time2 from the first row', () => {
    const row = firstRow(dropTeachTime2.apply(response()));
    expect('teach_time2' in row).toBe(false);
  });

  it('nulls the first subject name', () => {
    expect(
      firstRow(nullSubjectName.apply(response())).subject_name_th,
    ).toBeNull();
  });

  it('flips count to a number', () => {
    expect(firstRow(flipCountToNumber.apply(response())).count).toBe(0);
  });

  it('strips the teacher HTML wrapper', () => {
    const value = firstRow(stripTeacherHtml.apply(response())).teacher_list_th;
    expect(value).toBe('Plain Teacher Name');
  });

  it('injects an unknown field', () => {
    expect(
      'server_added_field' in firstRow(injectUnknownField.apply(response())),
    ).toBe(true);
  });

  it('corrupts the time string', () => {
    expect(firstRow(corruptTimeString.apply(response())).teach_time).toBe(
      '99:99',
    );
  });

  it('does not mutate the original response', () => {
    const original = response();
    dropTeachTime2.apply(original);
    expect('teach_time2' in firstRow(original)).toBe(true);
  });

  it('is a safe no-op when there is no section row', () => {
    expect(dropTeachTime2.apply({})).toEqual({});
    expect(dropTeachTime2.apply([])).toEqual([]);
  });
});
