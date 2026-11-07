// The cells of one section comparison row, and the cell classes both comparison layouts
// share. The fields themselves come from the one comparison field list, so the row and
// the transposed column show the same values. The section cell is the row header and
// stays in view as the table scrolls sideways, on the row's own zebra surface so the
// rows that pass under it never show through.

import type { Locale, Translate } from '@/lib/i18n/t';
import type { ComparisonRow } from '@/lib/catalog/compareSections';
import {
  ADD_HEAD,
  COMPARISON_FIELDS,
  SECTION_HEAD,
  SectionHeading,
  type ColumnHead,
} from './ComparisonFields';

/** The columns of the table with a row per section: the section pinned on the left, the
 * fields, and the add action pinned on the right. */
export const COLUMN_HEADS: readonly ColumnHead[] = [
  { ...SECTION_HEAD, pin: 'left' },
  ...COMPARISON_FIELDS,
  { ...ADD_HEAD, pin: 'right' },
];

/** The stacking and edge of a heading cell: a pinned heading is a corner over both axes. */
export function headPinClass(pin: ColumnHead['pin']): string {
  if (pin === 'left') return 'left-0 z-20';
  if (pin === 'right') return 'right-0 z-20 border-l';
  return 'z-10';
}

export const HEAD_CELL =
  'sticky top-0 border-b border-border bg-surface-alt px-2 py-1.5 text-left align-bottom font-semibold text-ink';

export const CELL = 'border-b border-border px-2 py-1.5 text-left align-top';

/** The surface of a body row, alternating so a wide row is easy to follow. Every cell of
 * the row takes it, so a pinned cell hides the cells that pass under it. */
export function rowSurface(zebra: boolean): string {
  return zebra ? 'bg-surface-alt' : 'bg-surface';
}

interface ComparisonCellsProps {
  row: ComparisonRow;
  /** Whether the row takes the alternate surface. */
  zebra: boolean;
  locale: Locale;
  t: Translate;
}

export function ComparisonCells({
  row,
  zebra,
  locale,
  t,
}: ComparisonCellsProps) {
  const surface = rowSurface(zebra);
  return (
    <>
      <th
        scope="row"
        className={`${CELL} ${surface} sticky left-0 z-[1] font-normal`}
      >
        <SectionHeading section={row.section} t={t} />
      </th>
      {COMPARISON_FIELDS.map(({ key, Body }) => (
        <td key={key} className={`${CELL} ${surface}`}>
          <Body row={row} locale={locale} t={t} />
        </td>
      ))}
    </>
  );
}
