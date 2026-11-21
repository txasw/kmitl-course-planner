// The measured content column of a placed block, in the inverted reading order of ADR-0047:
// the subject name first, a secondary name in the other language under it when the name
// language asks for both, the place with its location glyph and the section chip at the end
// of the same row, and the time and the subject id as quiet metadata at the foot. Every line
// sits in flow, so nothing is positioned over text: the section chip trails the place and
// wraps under it when the row is full, and an optional status dot leads the name (ADR-0047
// amendment of 2026-11-20).
//
// Every text field wraps rather than ellipsizes. The time and the subject id are the exception:
// they are whole fields on one line that never wraps, since a code split across two lines reads
// as two codes, and the density fit drops either whole when it is wider than its line rather
// than let it clip at the block edge (ADR-0046 amendment of 2026-11-20). A Thai name breaks at
// the browser's dictionary word boundaries, and a Thai word wider than the whole line breaks
// inside the word as a last resort. An English name breaks only at its spaces, since the API
// sends it in capitals, which Chromium does not hyphenate, so a word broken inside would
// strand letters on a line with no hyphen. Where a word of the name is wider than the line, the
// density fit steps the name form down instead: one type step smaller, then for a name in Latin
// script its abbreviated forms, and last the break form, where the word still too wide breaks
// inside. The name always shows and the subject id never takes its place (ADR-0047 amendment of
// 2026-11-22). The secondary name wraps
// only between its words in either language and drops whole when a word is wider than its
// line. The name shows in full until the density fit clamps it to the lines the box holds, and
// the block itself is the expand affordance, opening the full detail.
//
// Where the grid asks for the name only rule, a day column of the phone week or a suggestion
// slide, a block narrower than 7em shows the name alone with tight padding, so the name has
// the width it needs to break between words; the place, the chip, and the foot return as soon
// as the block is wide enough. A landscape block never takes the rule, since its width is the
// meeting length, so a 60 minute meeting there keeps its place (see narrowBlock).

import type { RefObject } from 'react';
import { MapPin } from 'lucide-react';
import type { Locale } from '@/lib/i18n/t';
import type { DensityLevel } from '@/lib/planner/blockDensity';
import type { BlockBadge } from './blockBadge';
import { chipClass, type BlockSurface } from './blockSurface';
import {
  HATCH_BACKDROP,
  NAME_CLAMP,
  WHOLE_FIELD,
  nameClampStyle,
  nameLine,
} from './blockText';
import { NARROW_HIDDEN, removeClearance } from './narrowBlock';

interface EventBlockContentProps {
  contentRef: RefObject<HTMLDivElement | null>;
  level: DensityLevel;
  name: string;
  nameLang: Locale;
  /** The other language's name under a choice of both, or null. */
  secondary: string | null;
  secondaryLang: Locale | null;
  place: string;
  sectionCode: string;
  time: string;
  subjectId: string;
  /** The abbreviated forms of the name, least shortened first. */
  abbreviations: readonly string[];
  color: string;
  badge: BlockBadge | null;
  surface: BlockSurface;
  /** Keep the name clear of the remove control that shows in the top right corner on hover
   * and focus under a fine pointer, and step the section chip aside while it shows. */
  reserveRemove: boolean;
  footAtBottom: boolean;
  /** Hide every line but the name while the block wrapper is narrower than 7em. */
  nameOnlyWhenNarrow: boolean;
}

// The section chip trails the place, so on a block whose name takes one line it can sit in
// the top right corner the remove control takes on hover and focus under a fine pointer.
// There it steps aside while the control shows, as the corner chip did; a coarse pointer
// hides the control, so there the chip stays.
const REMOVE_STEP_ASIDE =
  'not-pointer-coarse:group-hover/block:opacity-0 not-pointer-coarse:group-focus-within/block:opacity-0';

export function EventBlockContent({
  contentRef,
  level,
  name,
  nameLang,
  secondary,
  secondaryLang,
  place,
  sectionCode,
  time,
  subjectId,
  abbreviations,
  color,
  badge,
  surface,
  reserveRemove,
  footAtBottom,
  nameOnlyWhenNarrow,
}: EventBlockContentProps) {
  const showRow = level.showPlace || level.showSection;
  const narrowHidden = nameOnlyWhenNarrow ? NARROW_HIDDEN : '';
  // The quiet lines read ink soft, except over the danger hatch, where only ink keeps 4.5:1.
  const quiet = badge === 'danger' ? 'text-ink' : 'text-ink-soft';
  // Over the danger hatch the content stacks above the overlay and each text line sits on a
  // solid backdrop as wide as its text, so the stripes show around the text, not through it.
  const backdrop = badge === 'danger' ? HATCH_BACKDROP : '';
  const line = nameLine(level, name, nameLang, abbreviations);
  return (
    <div
      ref={contentRef}
      data-fit
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        badge === 'danger' ? 'relative' : ''
      }`}
    >
      <span
        data-fit-name
        data-name-form={level.nameForm}
        lang={line.lang}
        className={`shrink-0 font-semibold ${line.className} ${backdrop} ${
          level.nameLines === 'all' ? '' : NAME_CLAMP
        } ${reserveRemove ? removeClearance(nameOnlyWhenNarrow) : ''}`}
        style={nameClampStyle(level.nameLines)}
      >
        {badge !== null ? (
          <span
            aria-hidden
            className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${
              badge === 'danger' ? 'bg-danger' : 'bg-warn'
            }`}
          />
        ) : null}
        {line.text}
      </span>
      {level.showSecondary && secondary !== null ? (
        <span
          data-fit-whole="secondary"
          lang={secondaryLang ?? undefined}
          className={`shrink-0 overflow-hidden font-normal break-normal ${backdrop} ${narrowHidden} ${quiet}`}
        >
          {secondary}
        </span>
      ) : null}
      {showRow ? (
        <span
          className={`mt-0.5 flex shrink-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-ink ${backdrop} ${narrowHidden}`}
        >
          {level.showPlace ? (
            <span className="min-w-0 break-words">
              <MapPin
                size="0.85em"
                strokeWidth={2}
                aria-hidden
                className="mr-1 inline-block align-[-0.1em]"
                style={{ color }}
              />
              {place}
            </span>
          ) : null}
          {level.showSection ? (
            <span
              className={`shrink-0 rounded-kcp-inner px-1 text-[0.85em] tabular-nums ${chipClass(surface)} ${
                surface === 'soft' ? quiet : 'text-ink'
              } ${
                level.showPlace ? 'ml-auto' : ''
              } ${reserveRemove ? REMOVE_STEP_ASIDE : ''}`}
            >
              {sectionCode}
            </span>
          ) : null}
        </span>
      ) : null}
      {/* On the poster the foot sits at the bottom of the fitted box. In edit it follows the
          place closely, so a tall block reads as one cluster with its spare height below
          rather than split into a top and a bottom group. An empty foot is left out, so its
          margin never costs the name a line. */}
      {level.showTime || level.showId ? (
        <div
          className={`${footAtBottom ? 'mt-auto' : 'mt-1'} min-h-0 pt-0.5 ${backdrop} ${narrowHidden} ${quiet}`}
        >
          {level.showTime ? (
            <span
              data-fit-whole="time"
              className={`${WHOLE_FIELD} text-[0.9em] tabular-nums`}
            >
              {time}
            </span>
          ) : null}
          {level.showId ? (
            <span data-fit-whole="id" className={`${WHOLE_FIELD} tabular-nums`}>
              {subjectId}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
