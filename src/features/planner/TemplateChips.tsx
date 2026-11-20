// The export template picker of the gallery (ADR-0045 amendment of 2026-11-21): one chip per
// template, each carrying the template name, its exact output pixels, and a device glyph
// turned to the canvas orientation, so the choice reads as a picker without paging to it. The
// chips are a radiogroup with a roving tab stop; the arrow keys, Home, and End move through
// the pager hook, which clamps at the ends and lands focus on the selected chip. The selected
// chip is marked by more than colour: a check glyph takes the place of its device glyph, the
// name turns semibold, and the edge thickens. That edge is an inset orange ring, and the tab
// stop is always the selected chip, so the chips take the offset focus outline of ADR-0034
// rather than the inset ring, which would only have thickened the edge by a pixel. Every chip
// shows its whole text: the name takes the full chip width and wraps there, with the glyph and
// the size on the line under it, three chips to a row below 1024 px and all six in one row
// from there up. A phone turned on its side, 768 px wide or more and at most 500 px tall,
// also takes all six in one row, since a second row of chips there leaves the poster stage
// only about 110 px tall.

import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  RefObject,
} from 'react';
import {
  Check,
  Monitor,
  Printer,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react';
import {
  templateOutputHeight,
  templateOutputWidth,
  type ExportTemplate,
} from '@/lib/planner/exportTemplates';
import { useTranslation } from '@/features/shell/useTranslation';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface TemplateChipsProps {
  templates: readonly ExportTemplate[];
  selected: number;
  onSelect: (index: number) => void;
  /** The pager's group ref, so a key move can focus the selected chip. */
  groupRef: RefObject<HTMLDivElement | null>;
  /** The pager's key handler: the arrow keys, Home, and End. */
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/** The device a template is made for, read from its slug, which names its use. */
function templateGlyph(template: ExportTemplate): LucideIcon {
  if (template.slug.startsWith('phone')) return Smartphone;
  if (template.slug.startsWith('tablet')) return Tablet;
  if (template.slug.startsWith('print')) return Printer;
  return Monitor;
}

/** The exact output pixels of a template, as the chip and its name state them. */
function templateSize(template: ExportTemplate): string {
  return `${String(templateOutputWidth(template))} × ${String(
    templateOutputHeight(template),
  )}`;
}

const CHIP = `flex min-w-0 flex-col items-start justify-between gap-0.5 rounded-kcp border px-1 py-1.5 sm:px-2 text-left text-ink transition-colors ${TARGET_SIZE} ${FOCUS_OUTLINE}`;

const CHIP_STATE = {
  selected: 'border-primary bg-primary-soft ring-1 ring-primary ring-inset',
  idle: 'border-border bg-surface hover:border-ink-soft hover:bg-surface-alt',
} as const;

export function TemplateChips({
  templates,
  selected,
  onSelect,
  groupRef,
  onKeyDown,
}: TemplateChipsProps) {
  const { t } = useTranslation();
  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={t('preview.template.label')}
      className="grid shrink-0 grid-cols-3 gap-1.5 lg:grid-cols-6 md:[@media(max-height:500px)]:grid-cols-6"
    >
      {templates.map((template, index) => {
        const isSelected = index === selected;
        const Glyph = isSelected ? Check : templateGlyph(template);
        // A landscape canvas turns its device on its side, so the glyph reads its shape.
        const turned =
          !isSelected &&
          template.orientation === 'landscape' &&
          (Glyph === Smartphone || Glyph === Tablet);
        const glyph: ReactNode = (
          <Glyph
            size={14}
            strokeWidth={isSelected ? 2.5 : 2}
            aria-hidden
            className={`shrink-0 ${isSelected ? 'text-primary-strong' : 'text-ink-soft'} ${turned ? 'rotate-90' : ''}`}
          />
        );
        return (
          <button
            key={template.slug}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${t(template.labelKey)} · ${templateSize(template)}`}
            tabIndex={isSelected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              onSelect(index);
            }}
            className={`${CHIP} ${isSelected ? CHIP_STATE.selected : CHIP_STATE.idle}`}
          >
            <span
              className={`max-w-full text-xs sm:text-sm ${isSelected ? 'font-semibold' : ''}`}
            >
              {t(template.labelKey)}
            </span>
            <span className="flex items-center gap-1 text-2xs whitespace-nowrap text-ink-soft tabular-nums">
              {glyph}
              {templateSize(template)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
