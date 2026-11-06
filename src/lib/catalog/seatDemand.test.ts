import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import { makeSection } from '../../../tests/support/domain-builders';
import { normalizeTeachTable } from '../domain/normalize';
import {
  FULL_MARKER,
  teachTableResponseSchema,
  type RawSectionRow,
} from '../domain/schemas';
import type { Section } from '../domain/types';
import { createTranslator } from '../i18n/t';
import { computeSeatDemand, demandFigures, seatLineText } from './seatDemand';

const th = createTranslator('th');
const en = createTranslator('en');

const FIXTURE = 'teach-table.with-exams.capture.json';

function capturedSections(): Section[] {
  const result = normalizeTeachTable(loadFixture(FIXTURE));
  if (!result.ok) {
    throw new Error(`fixture ${FIXTURE} failed to normalize`);
  }
  return result.value.courses.flatMap((course) => course.sections);
}

// The raw rows keyed by teach_table_id, so each normalized section is checked against
// the fields the API actually sent rather than against the normalizer's own reading.
function rawRowsById(): Map<string, RawSectionRow> {
  const response = teachTableResponseSchema.parse(loadFixture(FIXTURE));
  const rows = new Map<string, RawSectionRow>();
  for (const grouping of response) {
    for (const block of grouping.teachtable) {
      for (const row of block.data) {
        if (!rows.has(row.teach_table_id)) {
          rows.set(row.teach_table_id, row);
        }
      }
    }
  }
  return rows;
}

function findSection(
  sections: Section[],
  subjectId: string,
  code: string,
): Section {
  const section = sections.find(
    (item) => item.subjectId === subjectId && item.section === code,
  );
  if (section === undefined) {
    throw new Error(`missing section ${subjectId} ${code}`);
  }
  return section;
}

describe('computeSeatDemand over the captured rows', () => {
  const sections = capturedSections();
  const raw = rawRowsById();

  it('covers every captured row', () => {
    expect(sections).toHaveLength(255);
    expect(raw.size).toBe(255);
  });

  it('derives each row state and counts from the raw seat fields', () => {
    for (const section of sections) {
      const row = raw.get(section.teachTableId);
      if (row === undefined) {
        throw new Error(`no raw row for ${section.teachTableId}`);
      }
      const demand = computeSeatDemand(section);
      const label = `${row.subject_id} ${row.section}`;
      const limit = row.limit === '-' ? null : Number(row.limit);
      const expectedState =
        row.closed === '1'
          ? 'closed'
          : row.count === FULL_MARKER
            ? 'full'
            : limit === null
              ? 'uncapped'
              : 'open';
      expect(demand.state, label).toBe(expectedState);
      expect(demand.limit, label).toBe(limit);
      expect(demand.enrolled, label).toBe(
        row.count === FULL_MARKER ? null : row.count,
      );
      expect(demand.preCount, label).toBe(row.pre_count);
      expect(demand.queueLeft, label).toBe(row.queue_left);
      expect(demand.oversubscribed, label).toBe(
        limit !== null && row.pre_count > limit,
      );
      if (expectedState === 'open' && typeof row.count === 'number') {
        expect(demand.remaining, label).toBe((limit ?? 0) - row.count);
        expect(seatLineText(demand, th), label).toBe(
          `ว่าง ${String(demand.remaining)} จาก ${String(limit)}`,
        );
      } else {
        expect(demand.remaining, label).toBeNull();
      }
    }
  });

  it('finds the uncapped, full, closed, and oversubscribed shapes', () => {
    const states = sections.map((section) => computeSeatDemand(section));
    const count = (predicate: (demand: (typeof states)[number]) => boolean) =>
      states.filter(predicate).length;
    expect(count((demand) => demand.state === 'uncapped')).toBe(141);
    expect(count((demand) => demand.state === 'full')).toBe(59);
    expect(count((demand) => demand.state === 'closed')).toBe(1);
    expect(count((demand) => demand.oversubscribed)).toBe(28);
  });

  it('reads an uncapped section, the API limit "-", as no seat limit', () => {
    const demand = computeSeatDemand(findSection(sections, '01006020', '1'));
    expect(demand).toMatchObject({
      state: 'uncapped',
      limit: null,
      remaining: null,
      enrolled: 440,
      oversubscribed: false,
    });
    expect(seatLineText(demand, th)).toBe('ไม่จำกัดที่นั่ง');
    expect(seatLineText(demand, en)).toBe('No seat limit');
  });

  it('reads the เต็ม/Full count as full with no enrolled number', () => {
    const demand = computeSeatDemand(findSection(sections, '90641007', '101'));
    expect(demand).toMatchObject({
      state: 'full',
      limit: 84,
      enrolled: null,
      remaining: null,
    });
    expect(seatLineText(demand, th)).toBe('เต็ม เพิ่มไม่ได้');
    expect(seatLineText(demand, en)).toBe('Full, cannot be added');
  });

  it('reads a closed section as closed', () => {
    const demand = computeSeatDemand(findSection(sections, '90641009', '942'));
    expect(demand.state).toBe('closed');
    expect(seatLineText(demand, th)).toBe('ปิด เพิ่มไม่ได้');
    expect(seatLineText(demand, en)).toBe('Closed, cannot be added');
  });

  it('flags an open section whose pre registrations exceed the limit', () => {
    const demand = computeSeatDemand(findSection(sections, '90644012', '911'));
    expect(demand).toMatchObject({
      state: 'open',
      limit: 60,
      enrolled: 59,
      remaining: 1,
      preCount: 64,
      oversubscribed: true,
    });
    expect(seatLineText(demand, th)).toBe('ว่าง 1 จาก 60');
    expect(seatLineText(demand, en)).toBe('1 of 60 open');
  });
});

describe('computeSeatDemand edge cases', () => {
  it('lets closed take priority over a full count', () => {
    const demand = computeSeatDemand(
      makeSection({
        isClosed: true,
        seats: { limit: 40, preCount: 50, queueLeft: 0, enrolled: 'full' },
      }),
    );
    expect(demand.state).toBe('closed');
    expect(demand.oversubscribed).toBe(true);
  });

  it('reads a capped section whose enrolled count reaches the limit as full', () => {
    const demand = computeSeatDemand(
      makeSection({
        seats: { limit: 30, preCount: 0, queueLeft: 0, enrolled: 30 },
      }),
    );
    expect(demand).toMatchObject({
      state: 'full',
      enrolled: 30,
      remaining: null,
    });
  });

  it('does not count pre registrations equal to the limit as oversubscribed', () => {
    const demand = computeSeatDemand(
      makeSection({
        seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 10 },
      }),
    );
    expect(demand.oversubscribed).toBe(false);
  });
});

describe('demandFigures', () => {
  it('lists the host counts for an oversubscribed full section', () => {
    const demand = computeSeatDemand(
      findSection(capturedSections(), '96642083', '101'),
    );
    expect(demand).toMatchObject({
      state: 'full',
      limit: 45,
      preCount: 171,
      queueLeft: 83,
      oversubscribed: true,
    });
    // The API sends only the full marker for enrolled, so that figure is left out.
    expect(demandFigures(demand)).toEqual([
      { key: 'limit', value: 45 },
      { key: 'pre', value: 171 },
      { key: 'queue', value: 83 },
    ]);
  });

  it('lists all four counts in the host column order', () => {
    const demand = computeSeatDemand(
      makeSection({
        seats: { limit: 45, preCount: 10, queueLeft: 5, enrolled: 33 },
      }),
    );
    expect(demandFigures(demand).map((figure) => figure.key)).toEqual([
      'limit',
      'enrolled',
      'pre',
      'queue',
    ]);
  });

  it('leaves the capacity out of an uncapped section', () => {
    const demand = computeSeatDemand(
      makeSection({
        seats: { limit: null, preCount: 3, queueLeft: 0, enrolled: 9 },
      }),
    );
    expect(demandFigures(demand)).toEqual([
      { key: 'enrolled', value: 9 },
      { key: 'pre', value: 3 },
      { key: 'queue', value: 0 },
    ]);
  });
});
