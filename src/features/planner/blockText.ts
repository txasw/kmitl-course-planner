// The text rules a placed block's content shares across its two layouts, the positioned block
// of ADR-0047 and the phone day card (ADR-0047 amendment of 2026-11-21): how the name wraps and
// steps down its forms, the clamp the density fit sets on it, the whole field that drops rather
// than clips, and the backdrop each line takes over the danger hatch.

import type { Locale } from '@/lib/i18n/t';
import type { DensityLevel, NameForm } from '@/lib/planner/blockDensity';
import type { StyleWithVars } from './blockSurface';

/** The backdrop of a text line over the danger hatch: as wide as its text, never past the
 * column, so the hatch reads beside a short line. */
export const HATCH_BACKDROP = 'kcp-hatch-backdrop w-fit max-w-full';

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
 * name form down, to the smaller name and then the subject id, rather than strand letters on
 * their own lines. Fonts differ by platform, so the same Thai word may fit one machine's column
 * and not another's; the rule holds on both because it reads the overflow, not a width. */
const NAME_WRAP = 'break-normal';

/** The text and type of the name line for its form: the subject id stands in for the name one
 * type step smaller on a line that never wraps, and a bare name shows no text. */
export function nameLine(
  form: NameForm,
  name: string,
  nameLang: Locale,
  subjectId: string,
): { text: string; className: string; lang: Locale | undefined } {
  switch (form) {
    case 'full':
      return {
        text: name,
        className: NAME_WRAP,
        lang: nameLang,
      };
    case 'small':
      return {
        text: name,
        className: `${NAME_WRAP} text-[0.9em]`,
        lang: nameLang,
      };
    case 'id':
      return {
        text: subjectId,
        className: 'whitespace-nowrap text-[0.9em] tabular-nums',
        lang: undefined,
      };
    case 'bare':
      return { text: '', className: '', lang: undefined };
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
