// The poster's optional exam schedule, below the unscheduled shelf and above the footer row,
// shown when the show exams display option is on (ADR-0064). It is ink only, with no danger
// mark on a clash, because the footer data line already states a clash as text and the reader
// of a shared image cannot act on an editing signal (ADR-0055). Its text is sized in em, so it
// follows each template's type scale like the data line and the watermark.
//
// The block yields to the grid: its height is capped at a quarter of the template's layout
// height, and when the lines do not fit it drops whole lines from the end of the list, closing
// with a count of what it dropped, so a line is either complete or absent and never clipped.
// The drop is measured the way the block fit of ADR-0046 is: it resets to every line when the
// lines, the template, or the fonts change, or when the block's width resizes, and otherwise
// demotes one line at a time inside a layout effect, so the capture reads the settled list.
// Only a width change resets, because dropping a line shrinks the block's height and a
// height triggered reset would refill it and loop.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { ExamSchedule } from '@/lib/planner/examSchedule';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import type { Locale, Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { examScheduleLines, type ExamScheduleLine } from './examScheduleLines';
import { useFontsReady } from './fontsReady';

/** The share of the template's layout height the block may take from the grid. */
export const EXAM_BLOCK_HEIGHT_SHARE = 0.25;

// The same sub pixel bias as the block fit: drop a line that barely fits rather than keep
// one clipped by a pixel, since the text export always carries every line.
const OVERFLOW_EPS = 0.5;

interface PosterExamBlockProps {
  schedule: ExamSchedule;
  template: ExportTemplate;
  displayOptions: DisplayOptions;
  locale: Locale;
  t: Translate;
}

/** The fit state: how many lines show, and the lines and reset key it was settled for. */
interface Fit {
  key: string;
  lines: readonly ExamScheduleLine[];
  shown: number;
}

export function PosterExamBlock({
  schedule,
  template,
  displayOptions,
  locale,
  t,
}: PosterExamBlockProps) {
  const lines = useMemo(
    () => examScheduleLines(schedule, displayOptions, locale, t),
    [schedule, displayOptions, locale, t],
  );
  const ref = useRef<HTMLElement>(null);
  const fontsReady = useFontsReady();
  // A width resize bumps the epoch, which changes the reset key and re-arms the fit.
  const [epoch, setEpoch] = useState(0);
  const resetKey = `${template.slug}|${fontsReady ? '1' : '0'}|${String(epoch)}`;
  const [fit, setFit] = useState<Fit>(() => ({
    key: resetKey,
    lines,
    shown: lines.length,
  }));
  // The lines or the reset key moved: restart from every line, adjusting during render
  // rather than in an effect, and the measurement below converges again from there.
  if (fit.key !== resetKey || fit.lines !== lines) {
    setFit({ key: resetKey, lines, shown: lines.length });
  }

  // Measure the committed list and drop one line from the end while it overflows the cap.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || fit.shown === 0) {
      return;
    }
    if (el.scrollHeight - el.clientHeight > OVERFLOW_EPS) {
      setFit({ ...fit, shown: fit.shown - 1 });
    }
  }, [fit]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) {
      return undefined;
    }
    // offsetWidth is the layout width, which the gallery's display scale does not change.
    let width = el.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth !== width) {
        width = el.offsetWidth;
        setEpoch((current) => current + 1);
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const hidden = lines.length - fit.shown;
  return (
    <section
      ref={ref}
      data-poster-exams
      data-fit
      aria-label={t('exam.schedule.title')}
      style={{
        maxHeight: template.layoutHeight * EXAM_BLOCK_HEIGHT_SHARE,
      }}
      className="shrink-0 overflow-hidden rounded-kcp border border-border p-2 text-[0.8em]"
    >
      <h3 className="mb-0.5 font-semibold text-ink-soft">
        {t('exam.schedule.title')}
      </h3>
      <ul
        lang={locale}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(16em,100%),1fr))] gap-x-4 gap-y-0.5"
      >
        {lines.slice(0, fit.shown).map((line) => (
          <li key={line.key} className="text-ink">
            <span className="text-ink-soft">
              {line.when === null ? line.label : `${line.label} ${line.when}`}
            </span>{' '}
            {line.subject}
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="text-ink-soft">
          {fillTemplate(t('poster.exams.more'), { count: hidden })}
        </p>
      ) : null}
    </section>
  );
}
