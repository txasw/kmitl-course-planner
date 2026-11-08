// The generated parts of the landing site (ADR-0066). The dedupe table in the
// Problem section is built from the real category search capture, in raw response
// order, and each row carries the subject's block color from the product's own
// hashColor, so the page and the screenshots agree. Nothing in the table is typed by
// hand. The functions here are pure; build-site.mjs writes their output into the pages
// and the site test checks the pages against them.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EVENT_PALETTE, hashColor } from '../../src/lib/utils/hash-color.ts';
import { DAY_MAP } from '../../src/lib/parsing/days.ts';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

/** The capture the table is generated from. */
export const DEDUPE_FIXTURE =
  'tests/fixtures/teach-table.by_subject_owner_id-32.capture.json';

const FULL = 'เต็ม/Full';

function readJson(relative) {
  return JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
}

const DICTS = {
  th: readJson('src/lib/i18n/th.json'),
  en: readJson('src/lib/i18n/en.json'),
};

const COPY = {
  th: {
    year: (n) => `ชั้นปี ${n}`,
    faculty: (name) => `คณะ${name}`,
    noCurriculum: 'ไม่ระบุหลักสูตร',
    join: ' ',
    lecture: 'ทฤษฎี',
    practice: 'ปฏิบัติ',
    full: 'เต็ม',
    seats: 'ที่นั่ง',
    chip: (n) => `พบใน ${n} หลักสูตร`,
  },
  en: {
    year: (n) => `year ${n}`,
    faculty: (name) => `Faculty of ${name}`,
    noCurriculum: 'no curriculum',
    join: ', ',
    lecture: 'Lecture',
    practice: 'Practice',
    full: 'Full',
    seats: 'Seats',
    chip: (n) => `Listed under ${n} curricula`,
  },
};

/** The curriculum grouping a raw row is listed under, in the page language. */
function groupingLabel(group, locale) {
  const copy = COPY[locale];
  const curriculum =
    locale === 'th' ? group.curriculum_name_th : group.curriculum_name_en;
  const department =
    locale === 'th' ? group.department_name_th : group.department_name_en;
  const faculty =
    locale === 'th' ? group.faculty_name_th : group.faculty_name_en;
  const parts = [];
  if (curriculum !== null && curriculum !== '') {
    parts.push(curriculum);
  } else if (
    group.department_id !== 'x' &&
    department !== null &&
    department !== ''
  ) {
    parts.push(department);
  } else {
    parts.push(copy.faculty(faculty), copy.noCurriculum);
  }
  if (group.class !== '0') {
    parts.push(copy.year(group.class));
  }
  return parts.join(copy.join);
}

function hhmm(time) {
  return time.slice(0, 5);
}

/** Every raw row of the capture in response order, with its display fields. */
export function dedupeRows(locale) {
  const groups = readJson(DEDUPE_FIXTURE);
  const copy = COPY[locale];
  const dict = DICTS[locale];
  const raw = [];
  for (const group of groups) {
    for (const type of group.teachtable) {
      for (const row of type.data) {
        raw.push({ group, row });
      }
    }
  }
  const listings = new Map();
  for (const { row } of raw) {
    listings.set(
      row.teach_table_id,
      (listings.get(row.teach_table_id) ?? 0) + 1,
    );
  }
  const seen = new Set();
  return raw.map(({ group, row }) => {
    const duplicate = seen.has(row.teach_table_id);
    seen.add(row.teach_table_id);
    const day = DAY_MAP.get(row.teach_day);
    const color = hashColor(row.subject_id);
    return {
      id: row.teach_table_id,
      duplicate,
      chip: duplicate ? null : copy.chip(listings.get(row.teach_table_id)),
      subjectClass: `subject-${String(EVENT_PALETTE.indexOf(color))}`,
      grouping: groupingLabel(group, locale),
      subjectId: row.subject_id,
      name: locale === 'th' ? row.subject_name_th : row.subject_name_en,
      section: `${row.section} ${row.lect_or_prac === 'ป' ? copy.practice : copy.lecture}`,
      time: `${day === undefined ? '' : dict[`day.${String(day)}`]} ${hhmm(row.teach_time)}-${hhmm(row.teach_time2)}`,
      seats:
        row.count === FULL ? copy.full : `${String(row.count)}/${row.limit}`,
    };
  });
}

/** The counts the copy around the table states. */
export function dedupeCounts() {
  const rows = dedupeRows('th');
  const groups = readJson(DEDUPE_FIXTURE);
  return {
    rows: rows.length,
    sections: rows.filter((row) => !row.duplicate).length,
    groupings: groups.length,
  };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cell(content, extra = '') {
  return `<td role="cell"${extra}><div class="fold"><div>${content}</div></div></td>`;
}

/** The table body rows as HTML, one tr per raw row. */
export function renderDedupeRows(locale) {
  const seatsLabel = escapeHtml(COPY[locale].seats);
  // A Thai subject name is one compound to its reader, so it never breaks inside.
  const name = (text) =>
    locale === 'th'
      ? `<span class="nw">${escapeHtml(text)}</span>`
      : escapeHtml(text);
  return dedupeRows(locale)
    .map((row) => {
      const chip =
        row.chip === null
          ? ''
          : ` <span class="dedupe__chip">${escapeHtml(row.chip)}</span>`;
      const kind = row.duplicate ? 'repeat' : 'first';
      return [
        `<tr role="row" class="dedupe__row ${row.subjectClass}" data-row="${kind}">`,
        cell(`${escapeHtml(row.grouping)}${chip}`, ' class="dedupe__grouping"'),
        cell(escapeHtml(row.subjectId), ' class="dedupe__id"'),
        cell(name(row.name), ' class="dedupe__name"'),
        cell(escapeHtml(row.section), ' class="dedupe__section"'),
        cell(escapeHtml(row.time), ' class="dedupe__time"'),
        cell(
          `<span data-label="${seatsLabel}">${escapeHtml(row.seats)}</span>`,
          ' class="dedupe__seats"',
        ),
        '</tr>',
      ].join('');
    })
    .join('\n');
}

/** The extension version the pages state, read from package.json. */
export function extensionVersion() {
  return readJson('package.json').version;
}
