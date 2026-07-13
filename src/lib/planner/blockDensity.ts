// The density ladder for a placed timetable block on the export poster. A block box has a
// fixed height from its grid cell, so its content may not fit. Rather than clip a line mid
// glyph, the poster drops whole fields by measurement: it starts at the full field set and
// demotes one rung at a time until the content fits its box (ADR-0046). This module is the
// only place the drop priority lives; it is pure so the policy is unit tested apart from the
// DOM measurement that walks it. The measurement glue is `useDensityFit`.
//
// Drop order, first dropped to last: subject id, then the place line, then the section chip,
// then the English secondary line, then the name reduces from two clamped lines to one, then
// the name drops. The time is never dropped. Because the id drops before the place, a block
// with room for only one foot line keeps the place, which says where the class meets, and
// drops the id, which the text export still carries.

/** Which fields a block could show before any measurement, from its data and the display
 * options. `mask` is a stable primitive so a reset key can compare eligibility cheaply. */
export interface DensityEligibility {
  hasName: boolean;
  hasEnglish: boolean;
  hasSection: boolean;
  hasId: boolean;
  hasPlace: boolean;
  mask: string;
}

/** A chosen field set for one block. `nameLines` is 0 when even a single clamped name line
 * does not fit, the last resort below which only the time remains. */
export interface DensityLevel {
  nameLines: 0 | 1 | 2;
  showEnglish: boolean;
  showSection: boolean;
  showId: boolean;
  showPlace: boolean;
}

/** Build the eligibility from the raw field predicates, deriving the stable mask. */
export function buildEligibility(
  e: Omit<DensityEligibility, 'mask'>,
): DensityEligibility {
  const bit = (value: boolean): string => (value ? '1' : '0');
  const mask = `${bit(e.hasName)}${bit(e.hasEnglish)}${bit(e.hasSection)}${bit(e.hasId)}${bit(e.hasPlace)}`;
  return { ...e, mask };
}

/** The fullest level for an eligibility: every eligible field shown, the name at two lines. */
export function fullLevel(e: DensityEligibility): DensityLevel {
  return {
    nameLines: e.hasName ? 2 : 0,
    showEnglish: e.hasEnglish,
    showSection: e.hasSection,
    showId: e.hasId,
    showPlace: e.hasPlace,
  };
}

/** Whether two levels choose the same field set, so a reset can skip a redundant update. */
export function sameLevel(a: DensityLevel, b: DensityLevel): boolean {
  return (
    a.nameLines === b.nameLines &&
    a.showEnglish === b.showEnglish &&
    a.showSection === b.showSection &&
    a.showId === b.showId &&
    a.showPlace === b.showPlace
  );
}

/** The next sparser level, dropping exactly one field in the fixed priority, or null when
 * only the time remains and nothing more can yield. A field already absent is skipped, so
 * an eligibility that never had a field walks straight past its rung. */
export function nextDensityLevel(level: DensityLevel): DensityLevel | null {
  if (level.showId) {
    return { ...level, showId: false };
  }
  if (level.showPlace) {
    return { ...level, showPlace: false };
  }
  if (level.showSection) {
    return { ...level, showSection: false };
  }
  if (level.showEnglish) {
    return { ...level, showEnglish: false };
  }
  if (level.nameLines === 2) {
    return { ...level, nameLines: 1 };
  }
  if (level.nameLines === 1) {
    return { ...level, nameLines: 0 };
  }
  return null;
}
