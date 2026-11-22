// The text rules a placed block's content shares across its two layouts, the positioned block
// of ADR-0047 and the phone day card (ADR-0047 amendment of 2026-11-21): how the name wraps and
// steps down its forms, never giving way to the subject id (amendment of 2026-11-22), the clamp
// the density fit sets on it, and the whole field that drops rather than clips.

import type { Locale } from '@/lib/i18n/t';
import type { DensityLevel } from '@/lib/planner/blockDensity';
import type { StyleWithVars } from './blockSurface';

/** A whole field: one line that never wraps and clips its own overflow, so the fit can read
 * its scroll width against its line and drop it whole before the overflow ever paints. */
export const WHOLE_FIELD = 'block overflow-hidden whitespace-nowrap';

/** The custom property that carries the name clamp, read by the line clamp utility. */
const NAME_LINES_PROPERTY = '--kcp-name-lines';

/** The line clamp utility that reads the name clamp. */
export const NAME_CLAMP = 'line-clamp-(--kcp-name-lines)';

/** How the name wraps: at the breaks the browser finds between words, which for Thai are its
 * dictionary words and for any other script its spaces, and never inside a word. A word wider
 * than the line then overflows the name, and the fit reads that as an overflow and steps the
 * name form down, to the smaller name and then its abbreviations, rather than strand letters on
 * their own lines. Fonts differ by platform, so the same Thai word may fit one machine's column
 * and not another's; the rule holds on both because it reads the overflow, not a width. */
const NAME_WRAP = 'break-normal';

/** The last resort of the break form: a word still wider than the line breaks at grapheme
 * cluster boundaries, and every other break stays where the browser finds it. */
const NAME_BREAK = 'break-normal wrap-anywhere';

/** The type step every form past the first takes. */
const SMALL = 'text-[0.9em]';

/** The text and type of the name line for its form (the ADR-0047 amendment of 2026-11-22). Every
 * form shows the name: in full, one type step smaller, as one of its abbreviated forms at that
 * size, or, in the break form, as its shortest abbreviated form, or in full where it has none,
 * with the word still too wide broken inside. */
export function nameLine(
  level: Pick<DensityLevel, 'nameForm' | 'nameAbbreviation'>,
  name: string,
  nameLang: Locale,
  abbreviations: readonly string[],
): { text: string; className: string; lang: Locale } {
  switch (level.nameForm) {
    case 'full':
      return { text: name, className: NAME_WRAP, lang: nameLang };
    case 'small':
      return { text: name, className: `${NAME_WRAP} ${SMALL}`, lang: nameLang };
    case 'abbreviated':
      return {
        text: abbreviations[level.nameAbbreviation] ?? name,
        className: `${NAME_WRAP} ${SMALL}`,
        lang: nameLang,
      };
    case 'break':
      return {
        text: abbreviations.at(-1) ?? name,
        className: `${NAME_BREAK} ${SMALL}`,
        lang: nameLang,
      };
  }
}

/** The name clamp for a level: no clamp while the name shows in full. */
export function nameClampStyle(
  nameLines: DensityLevel['nameLines'],
): StyleWithVars {
  return nameLines === 'all'
    ? {}
    : { [NAME_LINES_PROPERTY]: String(nameLines) };
}
