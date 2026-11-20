// The density ladder for a placed timetable block, a positioned surface where the row and the
// block's extent already encode the meeting time (ADR-0047). A block box has a fixed height
// from its grid cell, so its content may not fit; rather than clip a line mid glyph, the block
// drops whole fields by measurement, starting from the full set and demoting one rung at a time
// until the content fits. The poster and the edit grid walk this one ladder (ADR-0050). An edit
// block always carries the subject id and never a secondary name, so on a short edit block the
// id is the first field to go, which is safe because its hover card and its details still show
// it. This module is the only place the drop priority lives; it is pure so the policy is unit
// tested apart from the DOM measurement that walks it.
//
// The priority inverts the usual reading order because position carries the time. Drop order,
// first dropped to last: the subject id, then the secondary name (the second language under a
// name language of both), then the time (redundant here, the row and extent encode it), then
// the name gives up the lines past its second, then the section chip, then the name reduces
// from two clamped lines to one, then the place. The name alone never drops. At full density
// the name is not clamped, so a name the box can hold shows in full (the ADR-0047 amendment of
// 2026-11-20); its first reduction clamps it to the lines that fit in one step, from a
// measurement the caller passes, and never below two. Two constraints are binding: the place
// outlives the name's second line, since a one line ellipsized name still identifies the course
// while a lost room is recoverable nowhere else on the sheet, and the time never outlives the
// place, since the place is the field position cannot encode. The time is kept present as a
// quiet foot line rather than deleted, so a ninety minute block still reads its exact minutes.
//
// Width is measured as well as height (the ADR-0046 amendment of 2026-11-20). The subject id
// and the time are whole fields: each sits on one unbreakable line, since a code split across
// two lines or cut at the box edge reads as a different code, so each shows at its full width
// or drops whole. A whole field the measurement finds wider than its line drops at once, out of
// ladder order, because no other rung can widen the line it needs; the ladder order then
// governs the height as before.
//
// A word of an English name keeps its letters on one line (the ADR-0047 amendment of
// 2026-11-21). The browser breaks a Thai name at its dictionary word boundaries, so a Thai name
// keeps the wrap it has, but an English word wider than the line would break with no hyphen and
// can strand one letter on a line. So an English name wraps only at its spaces, and where one of
// its words is wider than the line, the name form steps down instead: first to one type step
// smaller, then to the subject id in its place, and last, where even the id is wider than the
// line, to no text at all, the block keeping its color and stripe and its full detail one tap
// away. The secondary name is held to the same rule as a whole field: wider than its line by a
// word, it drops whole.

/** Which fields a block could show before any measurement, from its data and the display
 * options. `mask` is a stable primitive so a reset key can compare eligibility cheaply. */
export interface DensityEligibility {
  hasName: boolean;
  hasSecondary: boolean;
  hasSection: boolean;
  hasId: boolean;
  hasPlace: boolean;
  mask: string;
}

/** How many lines the name may take: every line it needs, or a clamp of at least one line. */
export type NameLines = 'all' | number;

/** How the name line reads: in full, one type step smaller, as the subject id in its place, or
 * as no text at all, each the next step for a name with a word wider than its line. */
export const NAME_FORMS = ['full', 'small', 'id', 'bare'] as const;
export type NameForm = (typeof NAME_FORMS)[number];

/** A chosen field set for one block. `nameLines` is never below 1: the name is the primary
 * anchor and always shows at least one clamped line. The time can drop because position
 * encodes it. */
export interface DensityLevel {
  nameLines: NameLines;
  nameForm: NameForm;
  showSecondary: boolean;
  showPlace: boolean;
  showSection: boolean;
  showTime: boolean;
  showId: boolean;
}

/** What the block measured of its name when its content overflowed: the lines the name now
 * renders, and how many lines of content stand past the box. The ladder uses it to clamp the
 * name to the lines that fit in one step rather than a line at a time. */
export interface NameFit {
  lines: number;
  excessLines: number;
}

/** The fewest lines the name keeps while the section chip still shows. */
const NAME_LINES_BEFORE_SECTION = 2;

/** A field that shows whole or not at all: the subject id and the time on one line that never
 * wraps, and the secondary name, which wraps only between its words. */
export type WholeField = 'id' | 'time' | 'secondary';

/** Build the eligibility from the raw field predicates, deriving the stable mask. */
export function buildEligibility(
  e: Omit<DensityEligibility, 'mask'>,
): DensityEligibility {
  const bit = (value: boolean): string => (value ? '1' : '0');
  const mask = `${bit(e.hasName)}${bit(e.hasSecondary)}${bit(e.hasSection)}${bit(e.hasId)}${bit(e.hasPlace)}`;
  return { ...e, mask };
}

/** The fullest level for an eligibility: every eligible field shown, the name unclamped, the
 * time present. The time is always eligible on a placed meeting, so it is not an eligibility
 * predicate. */
export function fullLevel(e: DensityEligibility): DensityLevel {
  return {
    nameLines: 'all',
    nameForm: 'full',
    showSecondary: e.hasSecondary,
    showPlace: e.hasPlace,
    showSection: e.hasSection,
    showTime: true,
    showId: e.hasId,
  };
}

/** Whether two levels choose the same field set, so a reset can skip a redundant update. */
export function sameLevel(a: DensityLevel, b: DensityLevel): boolean {
  return (
    a.nameLines === b.nameLines &&
    a.nameForm === b.nameForm &&
    a.showSecondary === b.showSecondary &&
    a.showPlace === b.showPlace &&
    a.showSection === b.showSection &&
    a.showTime === b.showTime &&
    a.showId === b.showId
  );
}

/** Whether the name may still give up lines before the section chip drops: it is unclamped,
 * or clamped above two lines. */
function nameAboveSectionFloor(nameLines: NameLines): boolean {
  return nameLines === 'all' || nameLines > NAME_LINES_BEFORE_SECTION;
}

/** The clamp that sheds the measured excess, never below two lines. Without a measurement the
 * clamp falls straight to two lines. */
function clampToFit(nameLines: NameLines, fit: NameFit | undefined): number {
  if (fit === undefined) {
    return NAME_LINES_BEFORE_SECTION;
  }
  const current = nameLines === 'all' ? fit.lines : nameLines;
  return Math.max(
    NAME_LINES_BEFORE_SECTION,
    current - Math.max(1, fit.excessLines),
  );
}

/** The next sparser level, dropping exactly one field or clamping the name in the fixed
 * priority, or null when only the one line name remains and nothing more can yield. A field
 * already absent is skipped, so an eligibility that never had a field walks straight past its
 * rung. The name clamps past its second line before the section chip drops and reduces to one
 * line before the place drops, so the place outlives the name's second line; the time drops
 * before both, so it never outlives the place. */
export function nextDensityLevel(
  level: DensityLevel,
  fit?: NameFit,
): DensityLevel | null {
  if (level.showId) {
    return { ...level, showId: false };
  }
  if (level.showSecondary) {
    return { ...level, showSecondary: false };
  }
  if (level.showTime) {
    return { ...level, showTime: false };
  }
  if (nameAboveSectionFloor(level.nameLines)) {
    return { ...level, nameLines: clampToFit(level.nameLines, fit) };
  }
  if (level.showSection) {
    return { ...level, showSection: false };
  }
  if (level.nameLines !== 1) {
    return { ...level, nameLines: 1 };
  }
  if (level.showPlace) {
    return { ...level, showPlace: false };
  }
  return null;
}

/** Drop the whole fields the block measured as wider than their line, leaving every other
 * field as it was. A field already absent stays absent. */
export function dropWholeFields(
  level: DensityLevel,
  fields: readonly WholeField[],
): DensityLevel {
  return {
    ...level,
    showId: level.showId && !fields.includes('id'),
    showTime: level.showTime && !fields.includes('time'),
    showSecondary: level.showSecondary && !fields.includes('secondary'),
  };
}

/** The next name form for a name with a word wider than its line, or null once the name shows
 * no text. The subject id takes the name's place, so it leaves the foot as it does. */
export function nextNameForm(level: DensityLevel): DensityLevel | null {
  switch (level.nameForm) {
    case 'full':
      return { ...level, nameForm: 'small' };
    case 'small':
      return { ...level, nameForm: 'id', showId: false };
    case 'id':
      return { ...level, nameForm: 'bare' };
    case 'bare':
      return null;
  }
}

/** A field the reclaim pass may offer back: the three top rungs of the ladder. */
export type ReclaimField = 'time' | 'secondary' | 'id';

/** The order the reclaim pass offers fields back, highest priority first, so a field the
 * ladder ranks higher wins any room two dropped fields compete for. */
const RECLAIM_ORDER: readonly ReclaimField[] = ['time', 'secondary', 'id'];

function canReclaim(
  field: ReclaimField,
  level: DensityLevel,
  e: DensityEligibility,
): boolean {
  switch (field) {
    case 'time':
      return !level.showTime;
    case 'secondary':
      return e.hasSecondary && !level.showSecondary;
    case 'id':
      return e.hasId && !level.showId && level.nameForm !== 'id';
  }
}

function withField(level: DensityLevel, field: ReclaimField): DensityLevel {
  switch (field) {
    case 'time':
      return { ...level, showTime: true };
    case 'secondary':
      return { ...level, showSecondary: true };
    case 'id':
      return { ...level, showId: true };
  }
}

/** Whether the walk stopped above the section chip and the place, so both still show where
 * eligible. Past that point a reclaimed field would show while a field the ladder ranks higher
 * stays hidden, and a returned time would outlive the place, which ADR-0047 forbids. */
function lowerRungsIntact(level: DensityLevel, e: DensityEligibility): boolean {
  return level.showSection === e.hasSection && level.showPlace === e.hasPlace;
}

/** The next dropped field to offer back once the content fits, or null when every eligible
 * dropped field has been tried or the walk already reached the section chip or the place. Only
 * the three top rungs are offered: each is the first field the ladder drops while shown, so an
 * offer that overflows is undone by the next demotion and never costs a field ranked above it. */
export function nextReclaim(
  level: DensityLevel,
  e: DensityEligibility,
  tried: readonly ReclaimField[],
): { field: ReclaimField; level: DensityLevel } | null {
  if (!lowerRungsIntact(level, e)) {
    return null;
  }
  for (const field of RECLAIM_ORDER) {
    if (!tried.includes(field) && canReclaim(field, level, e)) {
      return { field, level: withField(level, field) };
    }
  }
  return null;
}
