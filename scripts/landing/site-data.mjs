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
import { parseTimeToMinutes } from '../../src/lib/parsing/time.ts';
import { BANNED_THAI } from '../../src/lib/i18n/toneRules.ts';
import { PLAN_H, STORY_GHOST } from './story-plan.mjs';

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
  // A section's slot is its place among the unique sections in first appearance order,
  // the row it keeps once the repeats merge into it.
  const slots = new Map();
  return raw.map(({ group, row }) => {
    const duplicate = slots.has(row.teach_table_id);
    if (!duplicate) {
      slots.set(row.teach_table_id, slots.size);
    }
    const day = DAY_MAP.get(row.teach_day);
    const color = hashColor(row.subject_id);
    return {
      id: row.teach_table_id,
      duplicate,
      slot: slots.get(row.teach_table_id),
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

/** The subject search the dedupe statement quotes, a single subject with many listings. */
export const SUBJECT_SEARCH_FIXTURE =
  'tests/fixtures/teach-table.by_subject_id.capture.json';

/** The raw rows and the real sections of the subject search capture. */
export function subjectSearchCounts() {
  const ids = [];
  for (const group of readJson(SUBJECT_SEARCH_FIXTURE)) {
    for (const type of group.teachtable) {
      for (const row of type.data) {
        ids.push(row.teach_table_id);
      }
    }
  }
  return { rows: ids.length, sections: new Set(ids).size };
}

/** The capture the story grid is generated from, which holds every section of plan H. */
export const STORY_FIXTURE =
  'tests/fixtures/teach-table.with-exams.capture.json';

function minutes(time) {
  const parsed = parseTimeToMinutes(time);
  if (parsed === null) {
    throw new Error(`The story capture holds an unreadable time ${time}.`);
  }
  return parsed;
}

/**
 * The plan H timetable the story builds, in the page language: the six blocks that land
 * first in landing order, morning before afternoon and Monday first, then the section
 * dragged in and refused, the section that lands in its place, and the block it clashes
 * with. A subject whose Thai name holds a term the Thai tone rules reserve is named by its
 * id in both languages, as the rest of the page names it.
 */
export function storyBlocks(locale) {
  const rows = [];
  for (const group of readJson(STORY_FIXTURE)) {
    for (const type of group.teachtable) {
      rows.push(...type.data);
    }
  }
  const dict = DICTS[locale];
  const block = ([subjectId, section]) => {
    const row = rows.find(
      (r) => r.subject_id === subjectId && r.section === section,
    );
    if (row === undefined) {
      throw new Error(`The story capture lacks ${subjectId} ${section}.`);
    }
    const day = DAY_MAP.get(row.teach_day);
    if (day === undefined) {
      throw new Error(`${subjectId} ${section} has no weekday.`);
    }
    const reserved = BANNED_THAI.some((term) =>
      row.subject_name_th.includes(term),
    );
    return {
      subjectId,
      section,
      day,
      dayLabel: dict[`day.${String(day)}`],
      start: minutes(row.teach_time),
      end: minutes(row.teach_time2),
      time: `${hhmm(row.teach_time)}-${hhmm(row.teach_time2)}`,
      name: reserved
        ? subjectId
        : locale === 'th'
          ? row.subject_name_th
          : row.subject_name_en,
      credit: Number(row.credit),
      subjectClass: `subject-${String(EVENT_PALETTE.indexOf(hashColor(subjectId)))}`,
    };
  };
  const [ghostId] = STORY_GHOST;
  const plan = PLAN_H.map(block);
  const blocks = plan
    .filter((b) => b.subjectId !== ghostId)
    .sort((a, b) => a.start - b.start || a.day - b.day);
  const landed = plan.find((b) => b.subjectId === ghostId);
  const ghost = block(STORY_GHOST);
  const blocker = blocks.find(
    (b) => b.day === ghost.day && b.start < ghost.end && ghost.start < b.end,
  );
  if (landed === undefined || blocker === undefined) {
    throw new Error('The story needs a landed section and a clash.');
  }
  return {
    blocks,
    ghost,
    landed,
    blocker,
    credits: plan.reduce((sum, b) => sum + b.credit, 0),
    subjects: plan.length,
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
  return `<td role="cell"${extra}>${content}</td>`;
}

/**
 * The table body rows as HTML, one tr per raw row. Each row carries its raw index and its
 * section's slot, from which the stylesheet works out how far the row travels when the
 * repeats merge. A repeat row is hidden from assistive technology, which reads the four
 * sections the caption names. A cell that may be cut to one line carries its whole text
 * as a title.
 */
export function renderDedupeRows(locale) {
  const seatsLabel = escapeHtml(COPY[locale].seats);
  // A Thai subject name is one compound to its reader, so it never breaks inside.
  const name = (text) =>
    locale === 'th'
      ? `<span class="nw">${escapeHtml(text)}</span>`
      : escapeHtml(text);
  return dedupeRows(locale)
    .map((row, index) => {
      const chip =
        row.chip === null
          ? ''
          : ` <span class="dedupe__chip">${escapeHtml(row.chip)}</span>`;
      const kind = row.duplicate ? 'repeat' : 'first';
      return [
        `<tr role="row" class="dedupe__row ${row.subjectClass}" data-row="${kind}" data-i="${String(index)}" data-slot="${String(row.slot)}"${row.duplicate ? ' aria-hidden="true"' : ''}>`,
        cell(
          `<span class="dedupe__group">${escapeHtml(row.grouping)}</span>${chip}`,
          ` class="dedupe__grouping" title="${escapeHtml(row.grouping)}"`,
        ),
        cell(escapeHtml(row.subjectId), ' class="dedupe__id"'),
        cell(
          name(row.name),
          ` class="dedupe__name" title="${escapeHtml(row.name)}"`,
        ),
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
