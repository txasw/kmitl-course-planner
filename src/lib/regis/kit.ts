// Build the registration kit from a plan and one by subject id result per planned
// subject. The kit lists every section of each subject, decides which group is the
// planned one, and checks each group against the rest of the plan through the same
// placement engine the planner uses, so a fit badge on registration day means what it
// means in the planner. A by subject id read covers every curriculum, so a section code
// can be listed twice under different curricula; such codes are flagged, and the
// student's own curriculum, the one the plan entry's search named, decides which row
// is the planned one when the stored id is no longer listed.

import type { NormalizedCatalog } from '../domain/normalize';
import {
  snapshotToSection,
  type Plan,
  type PlanEntry,
  type SectionSnapshot,
} from '../domain/plan';
import type { Course, Section } from '../domain/types';
import type { TeachTableQuery } from '../messaging/protocol';
import { computeSeatStatus } from '../catalog/seatStatus';
import { idsEqual } from '../reference/filters';
import { ALL_OPTION } from '../search/formState';
import { checkPlacement, expandSectionGroup } from '../planner/placement';
import { toSourceQuery } from '../planner/sourceQuery';
import { groupEntriesBySubject } from '../planner/subjectGroups';
import { placedSections, toSnapshot } from '../planner/transaction';
import type { Term } from '../routing/academicTerms';
import type {
  KitFit,
  KitOption,
  KitSeat,
  KitSubject,
  RegistrationKit,
} from './kitSchema';

/** How long a kit stands in for the public data: a week covers the weekend before. */
export const KIT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The by subject id search for one subject, across every curriculum, as the host
 * itself sends it. */
export function subjectQuery(term: Term, subjectId: string): TeachTableQuery {
  return {
    mode: 'by_subject_id',
    selected_year: term.year,
    selected_semester: term.semester,
    search_all_faculty: true,
    search_all_department: true,
    search_all_curriculum: true,
    search_all_class_year: true,
    selected_subject_id: subjectId,
  };
}

/** Whether a kit was prepared within the age limit, measured from now. A kit stamped
 * in the future, under a clock set back since, counts as stale. */
export function isKitFresh(kit: RegistrationKit, nowMs: number): boolean {
  const prepared = Date.parse(kit.preparedAt);
  if (Number.isNaN(prepared) || prepared > nowMs) return false;
  return nowMs - prepared <= KIT_MAX_AGE_MS;
}

/** Whether a kit describes this plan in its current term. */
export function kitMatchesPlan(kit: RegistrationKit, plan: Plan): boolean {
  return (
    kit.planId === plan.id &&
    kit.year === plan.year &&
    kit.semester === plan.semester
  );
}

const ANY_CURRICULUM: readonly string[] = ['x', ALL_OPTION, ''];

/** The curriculum a subject's plan entries were searched under, when one names it. */
export function entryCurriculum(entries: readonly PlanEntry[]): string | null {
  for (const entry of entries) {
    const value = entry.sourceQuery.params.selected_curriculum;
    if (value !== undefined && !ANY_CURRICULUM.includes(value)) return value;
  }
  return null;
}

const byCode = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

function codeKey(section: { kind: string; section: string }): string {
  return `${section.kind}:${section.section}`;
}

function offeredToCurriculum(section: Section, curriculum: string): boolean {
  return (section.offeredTo ?? []).some((grouping) =>
    idsEqual(grouping.curriculumId, curriculum),
  );
}

/**
 * The fresh section that stands for a planned entry: the same id when it is still
 * listed, otherwise the same code and kind, preferring the row of the student's own
 * curriculum when the code is listed more than once.
 */
function resolvePlanned(
  course: Course,
  entry: PlanEntry,
  curriculum: string | null,
): Section | undefined {
  const byId = course.sections.find(
    (section) => section.teachTableId === entry.teachTableId,
  );
  if (byId !== undefined) return byId;
  const sameCode = course.sections.filter(
    (section) => codeKey(section) === codeKey(entry.snapshot),
  );
  if (curriculum !== null) {
    const own = sameCode.find((section) =>
      offeredToCurriculum(section, curriculum),
    );
    if (own !== undefined) return own;
  }
  return sameCode[0];
}

function groupSeat(group: readonly Section[]): KitSeat {
  const kinds = group.map((section) => computeSeatStatus(section).kind);
  if (kinds.includes('closed')) return 'closed';
  if (kinds.includes('full')) return 'full';
  return 'open';
}

function groupFit(placed: Section[], group: Section[]): KitFit {
  const result = checkPlacement(placed, group);
  if (result.ok) return 'fits';
  return result.conflicts.some((conflict) => conflict.kind === 'time')
    ? 'time'
    : 'exam';
}

function duplicateCodes(course: Course): string[] {
  const counts = new Map<string, { code: string; count: number }>();
  for (const section of course.sections) {
    const key = codeKey(section);
    const seen = counts.get(key);
    counts.set(key, { code: section.section, count: (seen?.count ?? 0) + 1 });
  }
  const codes = [...counts.values()]
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.code);
  return [...new Set(codes)].sort(byCode);
}

function buildOptions(
  course: Course,
  placed: Section[],
  plannedIds: ReadonlySet<string>,
  curriculum: string | null,
): KitOption[] {
  const seen = new Set<string>();
  const options: KitOption[] = [];
  for (const section of course.sections) {
    const group = [...expandSectionGroup(course, section)].sort((a, b) =>
      byCode(a.section, b.section),
    );
    const ids = group.map((member) => member.teachTableId);
    const key = ids.join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      ids,
      planned: ids.some((id) => plannedIds.has(id)),
      fit: groupFit(placed, group),
      seat: groupSeat(group),
      ownCurriculum:
        curriculum === null
          ? null
          : group.some((member) => offeredToCurriculum(member, curriculum)),
    });
  }
  return options;
}

function fallbackMeta(entries: readonly PlanEntry[], subjectId: string) {
  const meta = entries[0]?.snapshot.subjectMeta;
  return {
    subjectId,
    nameTh: meta?.nameTh ?? '',
    nameEn: meta?.nameEn ?? '',
    credit: meta?.credit ?? 0,
    creditStr: meta?.creditStr ?? '',
  };
}

function buildSubject(
  plan: Plan,
  subjectId: string,
  entries: PlanEntry[],
  catalog: NormalizedCatalog,
  fallbackCurriculum: string | null,
): KitSubject {
  const term: Term = { year: plan.year, semester: plan.semester };
  const sourceQuery = toSourceQuery(subjectQuery(term, subjectId));
  const course = catalog.courses.find((item) => item.subjectId === subjectId);
  if (course === undefined) {
    return {
      ...fallbackMeta(entries, subjectId),
      sourceQuery,
      sections: [],
      plannedIds: [],
      options: [],
      duplicateCodes: [],
    };
  }
  const curriculum = entryCurriculum(entries) ?? fallbackCurriculum;
  const planned = entries.flatMap((entry) => {
    const section = resolvePlanned(course, entry, curriculum);
    return section === undefined ? [] : [section.teachTableId];
  });
  const rest = plan.entries.filter((entry) => entry.subjectId !== subjectId);
  const sections: SectionSnapshot[] = course.sections.map((section) =>
    toSnapshot(course, section),
  );
  return {
    subjectId,
    nameTh: course.nameTh,
    nameEn: course.nameEn,
    credit: course.credit,
    creditStr: course.creditStr,
    sourceQuery,
    sections,
    plannedIds: [...new Set(planned)],
    options: buildOptions(
      course,
      placedSections(rest),
      new Set(planned),
      curriculum,
    ),
    duplicateCodes: duplicateCodes(course),
  };
}

export interface KitInput {
  plan: Plan;
  /** One result per planned subject id; null when the read failed. */
  results: ReadonlyMap<string, NormalizedCatalog | null>;
  preparedAt: string;
  /** The curriculum from the student's saved profile, used when an entry names none. */
  profileCurriculum?: string | null;
}

/** Build the kit for every planned subject, in the plan's subject order. */
export function buildRegistrationKit(input: KitInput): RegistrationKit {
  const { plan, results, preparedAt } = input;
  const subjects: KitSubject[] = [];
  const unread: string[] = [];
  for (const group of groupEntriesBySubject(plan.entries)) {
    const catalog = results.get(group.subjectId);
    if (catalog === undefined || catalog === null) {
      unread.push(group.subjectId);
      continue;
    }
    subjects.push(
      buildSubject(
        plan,
        group.subjectId,
        group.entries,
        catalog,
        input.profileCurriculum ?? null,
      ),
    );
  }
  return {
    planId: plan.id,
    year: plan.year,
    semester: plan.semester,
    preparedAt,
    subjects,
    unread,
  };
}

/** The course a kit subject's sections form, as a search result would carry it. */
export function kitSubjectCourse(subject: KitSubject): Course {
  return {
    subjectId: subject.subjectId,
    nameTh: subject.nameTh,
    nameEn: subject.nameEn,
    credit: subject.credit,
    creditStr: subject.creditStr,
    groupNameTh: '',
    groupNameEn: '',
    sections: subject.sections.map(snapshotToSection),
  };
}

/**
 * Check a kit again against the plan as it stands now, from the sections the kit already
 * holds, with no read. A backup saved to the plan moves the planned group and changes
 * what fits, so the badges follow the plan. A subject added to the plan after the kit
 * was prepared has no sections in it, so it reads as not prepared.
 */
export function refitKit(
  kit: RegistrationKit,
  plan: Plan,
  profileCurriculum: string | null = null,
): RegistrationKit {
  const results = new Map<string, NormalizedCatalog | null>();
  for (const subject of kit.subjects) {
    results.set(subject.subjectId, {
      courses: [kitSubjectCourse(subject)],
      duplicateCount: 0,
      multiMeetingCount: 0,
      warnings: [],
    });
  }
  return buildRegistrationKit({
    plan,
    results,
    preparedAt: kit.preparedAt,
    profileCurriculum,
  });
}

/** The kits the helper reads for a plan, by what each may be used for. */
export interface CompanionKits {
  /** The fresh kit checked against the plan as it stands: the one input fill reads. */
  kit: RegistrationKit | null;
  /**
   * A kit past the age limit, checked against the plan the same way, kept only to show
   * the student's saved section choices and the other sections as from older data. Fill
   * never reads it, so a stale kit can never start a run.
   */
  staleKit: RegistrationKit | null;
}

/** Split a plan's stored kit into the fresh kit and the display only stale one. */
export function companionKits(
  stored: RegistrationKit | null,
  plan: Plan | null,
  nowMs: number,
  profileCurriculum: string | null = null,
): CompanionKits {
  if (stored === null || plan === null) return { kit: null, staleKit: null };
  const refit = refitKit(stored, plan, profileCurriculum);
  return isKitFresh(stored, nowMs)
    ? { kit: refit, staleKit: null }
    : { kit: null, staleKit: refit };
}

/** The planned sections of a kit subject, in section code order. */
export function plannedSections(subject: KitSubject): SectionSnapshot[] {
  const ids = new Set(subject.plannedIds);
  return subject.sections.filter((section) => ids.has(section.teachTableId));
}

/** The conditions printed for a section group, each once, in one language. */
export function groupConditions(
  sections: readonly SectionSnapshot[],
  field: 'rulesTh' | 'rulesEn',
): string[] {
  const rules = sections
    .map((section) => section[field].trim())
    .filter((rule) => rule !== '');
  return [...new Set(rules)];
}

/** The 8 digit subject ids a condition names, each once, in the order they appear. */
export function conditionIds(conditions: readonly string[]): string[] {
  return [
    ...new Set(
      conditions.flatMap((rule) => rule.match(/(?<!\d)\d{8}(?!\d)/g) ?? []),
    ),
  ];
}
