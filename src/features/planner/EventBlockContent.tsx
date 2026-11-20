// The measured content column of a placed block, in the inverted reading order of ADR-0047:
// the subject name first, a secondary name in the other language under it when the name
// language asks for both, the place with its location glyph and the section chip at the end of the same row, and the time
// and the subject id as quiet metadata at the foot. Every line sits in flow, so nothing is
// positioned over text: the section chip trails the place and wraps under it when the row is
// full, and an optional status dot leads the name (ADR-0047 amendment of 2026-11-20).
//
// Every text field wraps rather than ellipsizes. A Thai name breaks at the browser's dictionary word
// boundaries and an English one at spaces; a break inside a word is the last resort, for a word
// wider than the whole line. The API sends English names in capitals, which Chromium does not
// hyphenate, so such a word breaks with no hyphen. The name shows in full until the density fit
// clamps it to the lines the box holds, and the block itself is the expand affordance, opening
// the full detail.
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
import {
  chipClass,
  type BlockSurface,
  type StyleWithVars,
} from './blockSurface';
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

/** The custom property that carries the name clamp, read by the line clamp utility. */
const NAME_LINES_PROPERTY = '--kcp-name-lines';

/** The name clamp for a level: no clamp while the name shows in full. */
function nameClampStyle(nameLines: DensityLevel['nameLines']): StyleWithVars {
  return nameLines === 'all'
    ? {}
    : { [NAME_LINES_PROPERTY]: String(nameLines) };
}

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
  return (
    <div
      ref={contentRef}
      data-fit
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <span
        data-fit-name
        lang={nameLang}
        className={`shrink-0 font-semibold break-words hyphens-auto ${
          level.nameLines === 'all' ? '' : 'line-clamp-(--kcp-name-lines)'
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
        {name}
      </span>
      {level.showSecondary && secondary !== null ? (
        <span
          lang={secondaryLang ?? undefined}
          className={`shrink-0 font-normal break-words hyphens-auto ${narrowHidden} ${quiet}`}
        >
          {secondary}
        </span>
      ) : null}
      {showRow ? (
        <span
          className={`mt-0.5 flex shrink-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-ink ${narrowHidden}`}
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
          className={`${footAtBottom ? 'mt-auto' : 'mt-1'} min-h-0 pt-0.5 ${narrowHidden} ${quiet}`}
        >
          {level.showTime ? (
            <span className="block text-[0.9em] tabular-nums">{time}</span>
          ) : null}
          {level.showId ? (
            <span className="block break-words">{subjectId}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
