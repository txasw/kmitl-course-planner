// The unscheduled shelf: a slim region listing sections with no scheduled
// meeting, such as online or asynchronous courses, so their credits stay visible
// even though they never sit on the timetable. It renders only when the plan holds
// such a section. In edit mode each row adds a remove action and its enrollment
// conditions. The poster shelf in preview carries neither: the conditions are planning
// facts, and keeping them out holds the shared image and its measured fit unchanged.

import { AlertTriangle, BookOpen, FlaskConical } from 'lucide-react';
import { RulesNotice } from '@/features/catalog/RulesNotice';
import type { Locale, Translate } from '@/lib/i18n/t';
import { Pill } from '@/components/Pill';
import { Tooltip } from '@/components/Tooltip';
import type { PlacedSection } from './placedSection';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';

interface UnscheduledShelfProps {
  sections: PlacedSection[];
  locale: Locale;
  t: Translate;
  onRemove?: ((teachTableId: string) => void) | undefined;
  /** teachTableIds whose exam window overlaps another entry's, so the row reads danger. */
  examConflictIds?: Set<string>;
  /** Show the section code. A preview display option; on by default in edit mode. */
  showSection?: boolean;
  /** Add the English name as a secondary line under a Thai primary name. */
  showEnglishName?: boolean;
  /** Show the subject id. A preview display option, off by default there; on in edit mode. */
  showSubjectId?: boolean;
  /** The edit mode shelf. Only it lists each section's conditions, so they never enter
   * the poster capture or change the measured export fit. */
  editable?: boolean;
}

export function UnscheduledShelf({
  sections,
  locale,
  t,
  onRemove,
  examConflictIds,
  showSection = true,
  showEnglishName = false,
  showSubjectId = true,
  editable = false,
}: UnscheduledShelfProps) {
  return (
    <section
      aria-label={t('shelf.title')}
      className="shrink-0 rounded-kcp border border-border p-2"
    >
      <h3 className="mb-1 text-xs font-semibold text-ink-soft">
        {t('shelf.title')}
      </h3>
      <ul className="flex flex-col gap-1">
        {sections.map((section) => {
          const name = locale === 'th' ? section.nameTh : section.nameEn;
          const englishSecondary =
            showEnglishName && locale === 'th' && section.nameEn !== '';
          const examConflicted =
            examConflictIds?.has(section.teachTableId) ?? false;
          const badge = blockBadge(section.verifyStatus, false, examConflicted);
          const badgeText = blockBadgeLabelKeys(
            section.verifyStatus,
            false,
            examConflicted,
          )
            .map((key) => t(key))
            .join(' ');
          return (
            <li key={section.teachTableId} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-col text-ink">
                  <Tooltip
                    label={
                      showSubjectId ? `${section.subjectId} ${name}` : name
                    }
                  >
                    {(triggerProps, ref) => (
                      <span ref={ref} {...triggerProps} className="truncate">
                        {showSubjectId ? (
                          <>
                            <span className="font-semibold">
                              {section.subjectId}
                            </span>{' '}
                          </>
                        ) : null}
                        <span lang={locale}>{name}</span>
                      </span>
                    )}
                  </Tooltip>
                  {englishSecondary ? (
                    <span lang="en" className="truncate text-ink-soft">
                      {section.nameEn}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-ink-soft">
                  {badge !== null && badgeText !== '' ? (
                    <Pill
                      tone={badge}
                      icon={<AlertTriangle size={12} aria-hidden />}
                    >
                      {badgeText}
                    </Pill>
                  ) : null}
                  {showSection ? (
                    <span>
                      {t('section.code')} {section.section}
                    </span>
                  ) : null}
                  <Pill
                    tone="neutral"
                    icon={
                      section.kind === 'practice' ? (
                        <FlaskConical size={12} aria-hidden />
                      ) : (
                        <BookOpen size={12} aria-hidden />
                      )
                    }
                  >
                    {section.kind === 'practice'
                      ? t('section.practice')
                      : t('section.lecture')}
                  </Pill>
                  <span>
                    {section.credit} {t('footer.credits')}
                  </span>
                  {onRemove !== undefined ? (
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(section.teachTableId);
                      }}
                      className="rounded-kcp border border-border px-2 py-0.5 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {t('action.remove')}
                    </button>
                  ) : null}
                </span>
              </div>
              {editable ? (
                <RulesNotice
                  rulesTh={section.rulesTh}
                  rulesEn={section.rulesEn}
                  locale={locale}
                  t={t}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
