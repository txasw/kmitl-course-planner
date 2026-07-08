// The preview poster header: the plan name, the total credits, and the date the
// poster was generated. It is presentation only, shown when the panel is in
// preview mode, and carries no interactive control. Semester and year join it once
// the plan model carries them.

import type { Locale, Translate } from '@/lib/i18n/t';
import { summarizeCredits } from '@/lib/planner/credits';
import type { PlacedSection } from './placedSection';

interface PosterHeaderProps {
  planName: string;
  sections: PlacedSection[];
  locale: Locale;
  t: Translate;
  now?: Date;
}

export function PosterHeader({
  planName,
  sections,
  locale,
  t,
  now = new Date(),
}: PosterHeaderProps) {
  const credits = summarizeCredits(
    sections.map((section) => ({
      subjectId: section.subjectId,
      credit: section.credit,
    })),
  );
  const date = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    dateStyle: 'medium',
  }).format(now);

  return (
    <header className="shrink-0 border-b border-border pb-2">
      <h2 className="text-base font-semibold text-ink">{planName}</h2>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
        <span>
          {credits.credits} {t('footer.credits')}
        </span>
        <span>{date}</span>
      </div>
    </header>
  );
}
