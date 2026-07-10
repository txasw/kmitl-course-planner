// The preview poster header: the plan name, the semester over year, the total
// credits, and the date the poster was generated. It is presentation only, shown
// when the panel is in preview mode, and carries no interactive control.

import type { Locale, Translate } from '@/lib/i18n/t';
import type { Term } from '@/lib/routing/academicTerms';
import { summarizeCredits } from '@/lib/planner/credits';
import type { PlacedSection } from './placedSection';

interface PosterHeaderProps {
  planName: string;
  term: Term | null;
  sections: PlacedSection[];
  locale: Locale;
  t: Translate;
  now?: Date;
}

export function PosterHeader({
  planName,
  term,
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
      {/* The poster is captured to an image, so a long plan name wraps rather than
          truncating, which would hide part of the name in the export. break-words
          breaks a long unbroken Thai name so it never overflows the poster width. */}
      <h2
        className="text-base font-semibold break-words text-ink"
        title={planName}
      >
        {planName}
      </h2>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
        {term !== null ? (
          <span>
            {t('search.semester')} {term.semester}/{term.year}
          </span>
        ) : null}
        <span>
          {credits.credits} {t('footer.credits')}
        </span>
        <span>{date}</span>
      </div>
    </header>
  );
}
