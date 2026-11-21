// The density ladder for a placed timetable block, a positioned surface where the row and the
// block's extent already encode the meeting time (ADR-0047). A block box has a fixed height
// from its grid cell, so its content may not fit; rather than clip a line mid glyph, the block
// drops whole fields by measurement, starting from the full set and demoting one rung at a time
// until the content fits. The poster and the edit grid walk this one ladder (ADR-0050). An edit
// block always carries the subject id and names the subject in both languages, so on a short
// edit block the id is the first field to go and the second name the next, which is safe
// because its hover card and its details still show both. This module is the only place the drop priority lives; it is pure so the policy is unit
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
// The name always shows, and the subject id never stands in for it (the ADR-0047 amendment of
// 2026-11-22, superseding the id form of 2026-11-21). A name wraps only between its words, at the
// browser's dictionary breaks for Thai and at its spaces otherwise, and where one of its words is
// wider than the line the name form steps down: first to one type step smaller, then, for a name in
// Latin script, through its abbreviated forms at that size, least shortened first, and last to the
// break form, which keeps the shortest of those forms and lets the word still too wide break at
// grapheme cluster boundaries. A Thai name has no abbreviated forms, so it goes from the smaller
// step to the break form of the whole name. The subject id stays its own field under the show
// subject id option and the first field to drop. The secondary name is held to the word rule as a
// whole field: wider than its line by a word, it drops whole.
//
// The phone day card walks its own order (the ADR-0047 amendment of 2026-11-21). The card leads
// with the time, since one day column sets the time axis far from the text, so there the time
// is the last field to drop rather than the third: the subject id, then the secondary name, then
// the name lines past its second, then the section and kind chips, then the name to one line,
// then the place, and last the time. A one hour card keeps its time, a one line name, and its
// place.
//
// The poster block under a name language of both walks a third order (the ADR-0046 amendment of
// 2026-11-22): the time drops before the secondary name, since the student asked for both names
// and the block's position already states the time, so the second name no longer gives way to
// a line the sheet repeats. Below those two rungs the order is the block's, so the primary name
// still never drops and the place still outlives its second line.

/** Which fields a block could show before any measurement, from its data and the display
 * options. `mask` is a stable primitive so a reset key can compare eligibility cheaply. */
export interface DensityEligibility {
  hasName: boolean;
  hasSecondary: boolean;
  hasSection: boolean;
  hasId: boolean;
  hasPlace: boolean;
  /** How many abbreviated forms the name has, zero for a Thai name or one the rule cannot cut. */
  nameAbbreviations: number;
  mask: string;
}

/** How many lines the name may take: every line it needs, or a clamp of at least one line. */
export type NameLines = 'all' | number;

/** How the name line reads: in full, one type step smaller, abbreviated at that size, or with
 * the word still too wide broken at grapheme cluster boundaries, each the next step for a name
 * with a word wider than its line. Every form shows the name. */
export type NameForm = 'full' | 'small' | 'abbreviated' | 'break';

/** A chosen field set for one block. `nameLines` is never below 1: the name is the primary
 * anchor and always shows at least one clamped line. The time can drop because position
 * encodes it. */
export interface DensityLevel {
  nameLines: NameLines;
  nameForm: NameForm;
  /** Which abbreviated form the name shows, an index into its forms, zero outside that form. */
  nameAbbreviation: number;
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

/** Which drop order a block walks: the positioned block of the week grid and the poster, the
 * phone day card that leads with its time, or the poster block naming the subject in both
 * languages, which drops its time before its second name. */
export type DensityLadder = 'block' | 'dayCard' | 'posterBoth';

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
  const mask = `${bit(e.hasName)}${bit(e.hasSecondary)}${bit(e.hasSection)}${bit(e.hasId)}${bit(e.hasPlace)}${String(e.nameAbbreviations)}`;
  return { ...e, mask };
}

/** The fullest level for an eligibility: every eligible field shown, the name unclamped, the
 * time present. The time is always eligible on a placed meeting, so it is not an eligibility
 * predicate. */
export function fullLevel(e: DensityEligibility): DensityLevel {
  return {
    nameLines: 'all',
    nameForm: 'full',
    nameAbbreviation: 0,
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
    a.nameAbbreviation === b.nameAbbreviation &&
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
  ladder: DensityLadder = 'block',
): DensityLevel | null {
  if (level.showId) {
    return { ...level, showId: false };
  }
  if (ladder === 'posterBoth' && level.showTime) {
    return { ...level, showTime: false };
  }
  if (level.showSecondary) {
    return { ...level, showSecondary: false };
  }
  if (ladder === 'dayCard') {
    return nextDayCardLevel(level, fit);
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

/** The day card rungs below the id and the secondary name: the name clamp, the chips, the
 * one line name, and the place all yield before the time the card leads with. */
function nextDayCardLevel(
  level: DensityLevel,
  fit: NameFit | undefined,
): DensityLevel | null {
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
  if (level.showTime) {
    return { ...level, showTime: false };
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

/** The next name form for a name with a word wider than its line, or null once the word may
 * break inside, which never overflows the line. `abbreviations` counts the name's abbreviated
 * forms, each tried in turn, least shortened first. */
export function nextNameForm(
  level: DensityLevel,
  abbreviations: number,
): DensityLevel | null {
  const breakForm: DensityLevel = {
    ...level,
    nameForm: 'break',
    nameAbbreviation: 0,
  };
  switch (level.nameForm) {
    case 'full':
      return { ...level, nameForm: 'small' };
    case 'small':
      return abbreviations > 0
        ? { ...level, nameForm: 'abbreviated', nameAbbreviation: 0 }
        : breakForm;
    case 'abbreviated':
      return level.nameAbbreviation + 1 < abbreviations
        ? { ...level, nameAbbreviation: level.nameAbbreviation + 1 }
        : breakForm;
    case 'break':
      return null;
  }
}

/** A field the reclaim pass may offer back: the three top rungs of the ladder. */
export type ReclaimField = 'time' | 'secondary' | 'id';

/** The order the reclaim pass offers fields back, highest priority first, so a field the
 * ladder ranks higher wins any room two dropped fields compete for. The poster block under
 * both names ranks its second name above its time. */
const RECLAIM_ORDER: Record<DensityLadder, readonly ReclaimField[]> = {
  block: ['time', 'secondary', 'id'],
  dayCard: ['time', 'secondary', 'id'],
  posterBoth: ['secondary', 'time', 'id'],
};

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
      return e.hasId && !level.showId;
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
  ladder: DensityLadder = 'block',
): { field: ReclaimField; level: DensityLevel } | null {
  if (!lowerRungsIntact(level, e)) {
    return null;
  }
  for (const field of RECLAIM_ORDER[ladder]) {
    if (!tried.includes(field) && canReclaim(field, level, e)) {
      return { field, level: withField(level, field) };
    }
  }
  return null;
}
