// The section comparison turned on its side for a narrow panel. A phone has no room for
// nine columns, so the fields become the rows and the sections the columns: the field
// names sit in a first column that stays in view, and the sections scroll sideways
// beside it, two at a time, so the student still reads two sections next to each other
// at 360 px. The header row of section codes stays in view as the fields scroll under
// it, and a sideways scroll snaps to a section edge so no section is left half shown.
// The last row holds each section's add action, the same cell the wide table pins to
// its trailing edge.

import type { Translate } from '@/lib/i18n/t';
import { ComparisonAddCell } from './ComparisonAddCell';
import {
  ADD_HEAD,
  COMPARISON_FIELDS,
  HeadText,
  SECTION_HEAD,
  SectionHeading,
  type ColumnHead,
} from './ComparisonFields';
import {
  ComparisonScroller,
  type ComparisonLayoutProps,
} from './ComparisonTable';
import {
  CELL,
  HEAD_CELL,
  headPinClass,
  rowSurface,
} from './SectionComparisonCells';

/** The width of the pinned field name column. */
const FIELD_COLUMN = '6rem';

/** How many sections share the width beside the field column. */
const VISIBLE_SECTIONS = 2;

const FIELD_HEAD = 'sticky left-0 z-[1] border-r font-semibold text-ink';

/** The table width that gives each section column an equal share of two beside the
 * field column, so a third section starts past the edge. A single section fills both. */
export function transposedWidth(sections: number): string {
  const columns = Math.max(sections, VISIBLE_SECTIONS);
  return `calc(${FIELD_COLUMN} + ${String(columns)} * (100% - ${FIELD_COLUMN}) / ${String(VISIBLE_SECTIONS)})`;
}

interface FieldHeadProps {
  head: ColumnHead;
  zebra: boolean;
  t: Translate;
}

function FieldHead({ head, zebra, t }: FieldHeadProps) {
  return (
    <th scope="row" className={`${CELL} ${rowSurface(zebra)} ${FIELD_HEAD}`}>
      <HeadText head={head} t={t} />
    </th>
  );
}

export function ComparisonTransposed({
  rows,
  title,
  locale,
  t,
  blockedId,
  scrollerRef,
  onAdd,
  onSwitchTerm,
}: ComparisonLayoutProps) {
  const addZebra = COMPARISON_FIELDS.length % 2 === 1;
  return (
    <ComparisonScroller
      title={title}
      scrollerRef={scrollerRef}
      // The padding keeps a snapped section clear of the pinned field column.
      className="snap-x snap-mandatory"
      style={{ scrollPaddingLeft: FIELD_COLUMN }}
    >
      {/* A fixed layout holds every section column to its share, so a long value wraps
          inside its column instead of widening it. */}
      <table
        className="table-fixed border-separate border-spacing-0 text-xs"
        style={{ width: transposedWidth(rows.length) }}
      >
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {/* The corner names the header row of section codes beside it. */}
            <th
              scope="row"
              style={{ width: FIELD_COLUMN }}
              className={`${HEAD_CELL} ${headPinClass('left')} border-r`}
            >
              <HeadText head={SECTION_HEAD} t={t} />
            </th>
            {rows.map((row) => (
              <th
                key={row.section.teachTableId}
                scope="col"
                className={`${HEAD_CELL} ${headPinClass(undefined)}`}
              >
                {/* Chrome takes no snap area from a table cell, so a block inside the
                    heading snaps, its margin reaching back over the cell padding so
                    the column edge lands on the field column. */}
                <span className="block snap-start scroll-ml-2">
                  <SectionHeading section={row.section} t={t} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_FIELDS.map((field, index) => {
            const zebra = index % 2 === 1;
            return (
              <tr key={field.key}>
                <FieldHead head={field} zebra={zebra} t={t} />
                {rows.map((row) => (
                  <td
                    key={row.section.teachTableId}
                    className={`${CELL} ${rowSurface(zebra)} break-words`}
                  >
                    <field.Body row={row} locale={locale} t={t} />
                  </td>
                ))}
              </tr>
            );
          })}
          <tr>
            <FieldHead head={ADD_HEAD} zebra={addZebra} t={t} />
            {rows.map((row) => (
              <ComparisonAddCell
                key={row.section.teachTableId}
                row={row}
                zebra={addZebra}
                pinned={false}
                blocked={row.section.teachTableId === blockedId}
                t={t}
                onAdd={onAdd}
                onSwitchTerm={onSwitchTerm}
              />
            ))}
          </tr>
        </tbody>
      </table>
    </ComparisonScroller>
  );
}
