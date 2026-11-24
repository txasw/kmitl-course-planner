// The section tile of the subject in focus, the most prominent thing on the helper card
// because the section is what the student must enter right. Each half of the group is a
// column with its label over its number, Section for one section and Lecture and Practice
// for a pair. The tile carries the subject's planner colour as a stripe and a soft tint.
// When the kit has other sections and the subject still needs adding, the tile is the
// trigger of the section menu; otherwise it is plain text the card reads in place.

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SectionSnapshot } from '@/lib/domain/plan';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { hashColor } from '@/lib/utils/hash-color';
import type { StyleWithVars } from '@/features/planner/blockSurface';

export interface SectionPart {
  label: string;
  code: string;
}

/** The labelled halves of a section group: one section, or a lecture and its practice. */
export function sectionParts(
  sections: readonly SectionSnapshot[],
  t: Translate,
): SectionPart[] {
  if (sections.length === 1) {
    return sections.map((section) => ({
      label: t('regis.sectionWord'),
      code: section.section,
    }));
  }
  return sections.map((section) => ({
    label: t(
      section.kind === 'practice' ? 'section.practice' : 'section.lecture',
    ),
    code: section.section,
  }));
}

/** The halves as one phrase, for an accessible name or a list line. */
export function partsText(parts: readonly SectionPart[]): string {
  return parts.map((part) => `${part.label} ${part.code}`).join(', ');
}

/** The halves on one line, label before number, as the list rows and the menu show them. */
export function PartsLine({
  parts,
  muted = false,
  wide = false,
  children,
}: {
  parts: readonly SectionPart[];
  muted?: boolean;
  /** Take the free width of the row, as a menu option does. */
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={`flex flex-wrap items-baseline gap-x-3 ${wide ? 'min-w-0 flex-1' : ''}`}
    >
      {parts.map((part) => (
        <span key={`${part.label} ${part.code}`}>
          <span className="text-xs text-ink-soft">{part.label}</span>{' '}
          <span
            className={`text-base font-semibold tabular-nums ${muted ? 'text-ink-soft' : 'text-ink'}`}
          >
            {part.code}
          </span>
        </span>
      ))}
      {children}
    </span>
  );
}

const TILE =
  'kcp-soft-card kcp-soft-quiet relative flex shrink-0 items-center gap-3 py-1.5 border-l-3 border-l-(--kcp-tint) pl-3 text-left';

function Columns({ parts }: { parts: readonly SectionPart[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <span
          key={`${part.label} ${part.code}`}
          className={`flex min-w-8 flex-col ${
            index > 0
              ? 'border-l border-[color-mix(in_srgb,var(--kcp-tint)_24%,var(--kcp-surface))] pl-3'
              : ''
          }`}
        >
          <span className="text-xs whitespace-nowrap text-ink-soft">
            {part.label}
          </span>
          <span className="text-xl leading-8 font-semibold text-ink tabular-nums">
            {part.code}
          </span>
        </span>
      ))}
    </>
  );
}

interface SectionTileProps {
  subjectId: string;
  parts: readonly SectionPart[];
  /** The trigger props of the section menu, when the tile opens it. */
  trigger?: {
    props: Record<string, unknown>;
    open: boolean;
    label: string;
  };
}

export function SectionTile({ subjectId, parts, trigger }: SectionTileProps) {
  const style: StyleWithVars = { '--kcp-tint': hashColor(subjectId) };
  if (trigger === undefined) {
    return (
      <div style={style} className={`${TILE} pr-3`}>
        <Columns parts={parts} />
      </div>
    );
  }
  const chevron: ReactNode = (
    <ChevronDown
      size={16}
      aria-hidden
      className="-ml-1 mb-1 shrink-0 self-end text-ink-soft"
    />
  );
  return (
    <button
      {...trigger.props}
      type="button"
      aria-label={trigger.label}
      style={style}
      className={`${TILE} pr-2 hover:[--kcp-tint-edge:40%] ${
        trigger.open ? 'ring-2 ring-primary ring-inset' : ''
      } ${FOCUS_RING}`}
    >
      <Columns parts={parts} />
      {chevron}
    </button>
  );
}
