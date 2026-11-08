// Plan H, the plan the landing page shows (ADR-0066): seven subjects of the cybersecurity
// curriculum, year 1, 19 credits. The screenshot capture builds it through the panel and
// the page's story grid is generated from the same list, so the two never disagree.

/** Each entry is a subject id and the section the plan holds. */
export const PLAN_H = [
  ['01476101', '33'],
  ['04186098', '1'],
  ['01006020', '4'],
  ['01006503', '1'],
  ['01006021', '5'],
  ['01006030', '33'],
  ['01476012', '33'],
];

/**
 * The section the story drags in first: 01006021 section 3 meets Tuesday 09:00 to 12:00,
 * where it clashes with 01006020 section 4, before section 5 of the same subject lands.
 */
export const STORY_GHOST = ['01006021', '3'];
