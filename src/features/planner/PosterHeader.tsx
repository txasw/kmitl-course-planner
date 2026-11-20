// The preview poster header: the plan name, the semester over year, the total
// credits, and the date the poster was generated. It is presentation only, shown
// when the panel is in preview mode, and carries no interactive control. The date
// reads "D MMM BE" in both locales, the Buddhist year the term beside it uses, rather
// than the Gregorian year an English Intl date would print.

import type { Locale, Translate } from '@/lib/i18n/t';
import type { Term } from '@/lib/routing/academicTerms';
import { summarizeCredits } from '@/lib/planner/credits';
import { formatLocalDate } from './examText';
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
  const date = formatLocalDate(now, t);

  return (
    // The export clones the poster without its ancestors, so the header carries the
    // locale of its labels and date itself rather than inheriting the panel language.
    <header lang={locale} className="shrink-0 border-b border-border pb-2">
      {/* The poster is captured to an image, so a long plan name wraps rather than
          truncating, which would hide part of the name in the export. break-words
          breaks a long unbroken Thai name so it never overflows the poster width. */}
      <h2 className="text-base font-semibold break-words text-ink">
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
