// The density ladder for a placed timetable block, a positioned surface where the row and the
// block's extent already encode the meeting time (ADR-0047). A block box has a fixed height
// from its grid cell, so its content may not fit; rather than clip a line mid glyph, the poster
// drops whole fields by measurement, starting from the full set and demoting one rung at a time
// until the content fits. This module is the only place the drop priority lives; it is pure so
// the policy is unit tested apart from the DOM measurement that walks it.
//
// The priority inverts the usual reading order because position carries the time. Drop order,
// first dropped to last: the subject id, then the English name, then the time (redundant here,
// the row and extent encode it), then the section chip, then the name reduces from two clamped
// lines to one, then the place. The name alone never drops. Two constraints are binding: the
// place outlives the name's second line, since a one line ellipsized name still identifies the
// course while a lost room is recoverable nowhere else on the sheet, and the time never outlives
// the place, since the place is the field position cannot encode. The time is kept present as a
// quiet foot line rather than deleted, so a ninety minute block still reads its exact minutes.

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

/** A chosen field set for one block. `nameLines` is never 0: the name is the primary anchor and
 * always shows at least one clamped line. The time can drop because position encodes it. */
export interface DensityLevel {
  nameLines: 1 | 2;
  showEnglish: boolean;
  showPlace: boolean;
  showSection: boolean;
  showTime: boolean;
  showId: boolean;
}

/** Build the eligibility from the raw field predicates, deriving the stable mask. */
export function buildEligibility(
  e: Omit<DensityEligibility, 'mask'>,
): DensityEligibility {
  const bit = (value: boolean): string => (value ? '1' : '0');
  const mask = `${bit(e.hasName)}${bit(e.hasEnglish)}${bit(e.hasSection)}${bit(e.hasId)}${bit(e.hasPlace)}`;
  return { ...e, mask };
}

/** The fullest level for an eligibility: every eligible field shown, the name at two lines, the
 * time present. The time is always eligible on a placed meeting, so it is not an eligibility
 * predicate. */
export function fullLevel(e: DensityEligibility): DensityLevel {
  return {
    nameLines: 2,
    showEnglish: e.hasEnglish,
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
    a.showEnglish === b.showEnglish &&
    a.showPlace === b.showPlace &&
    a.showSection === b.showSection &&
    a.showTime === b.showTime &&
    a.showId === b.showId
  );
}

/** The next sparser level, dropping exactly one field in the fixed priority, or null when only
 * the name remains and nothing more can yield. A field already absent is skipped, so an
 * eligibility that never had a field walks straight past its rung. The name reduction to one
 * line comes before the place drops, so the place outlives the name's second line; the time
 * drops before both, so it never outlives the place. */
export function nextDensityLevel(level: DensityLevel): DensityLevel | null {
  if (level.showId) {
    return { ...level, showId: false };
  }
  if (level.showEnglish) {
    return { ...level, showEnglish: false };
  }
  if (level.showTime) {
    return { ...level, showTime: false };
  }
  if (level.showSection) {
    return { ...level, showSection: false };
  }
  if (level.nameLines === 2) {
    return { ...level, nameLines: 1 };
  }
  if (level.showPlace) {
    return { ...level, showPlace: false };
  }
  return null;
}
