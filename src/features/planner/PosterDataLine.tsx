// The data date beside the watermark in the poster footer, the text that carries what the
// edit mode verification badges carry on screen (ADR-0055). The first line always states how
// current the poster is, from the oldest check, or that nothing has been checked yet. A second
// line appears only when an entry was not found at the last check or a section pair clashes,
// and states each count in a plain sentence. It shares the watermark's quiet ink soft style
// and em relative size, so it scales with every template's type scale.

import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { DataDate, PosterHonesty } from '@/lib/planner/posterHonesty';
import { formatLocalDateTime } from './examText';

function dataDateText(dataDate: DataDate, t: Translate): string {
  if (dataDate.kind === 'unverified') {
    return t('poster.unverified');
  }
  return fillTemplate(t('poster.dataAsOf'), {
    dateTime: formatLocalDateTime(new Date(dataDate.at), t),
  });
}

function noteTexts(honesty: PosterHonesty, t: Translate): string[] {
  const notes: string[] = [];
  if (honesty.missingCount > 0) {
    notes.push(
      fillTemplate(t('poster.honesty.missing'), {
        count: honesty.missingCount,
      }),
    );
  }
  if (honesty.conflictPairCount > 0) {
    notes.push(
      fillTemplate(t('poster.honesty.conflict'), {
        count: honesty.conflictPairCount,
      }),
    );
  }
  return notes;
}

interface PosterDataLineProps {
  honesty: PosterHonesty;
  t: Translate;
}

export function PosterDataLine({ honesty, t }: PosterDataLineProps) {
  const notes = noteTexts(honesty, t);
  return (
    <div
      data-poster-data-line
      className="flex min-w-0 flex-col items-end text-right text-[0.8em] text-ink-soft"
    >
      <span>{dataDateText(honesty.dataDate, t)}</span>
      {notes.length > 0 ? (
        <span className="flex flex-wrap justify-end gap-x-2">
          {notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </span>
      ) : null}
    </div>
  );
}
