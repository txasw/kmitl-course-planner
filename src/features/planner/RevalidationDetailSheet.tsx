// The revalidation detail sheet, opened from the banner. It lists the entries a check
// changed or could not find, with old versus new values, so the one line summary can
// be expanded. It is a modal dialog over the panel, portaled out of the banner so its
// list is never read as a live status update, with focus contained inside it and
// returned to its opener on close. It dismisses on the scrim, the close control, or
// Escape, which closes only the dialog and not the whole overlay.

import { ModalDialog } from '@/components/ModalDialog';
import type { Locale, Translate } from '@/lib/i18n/t';
import { useActiveRun } from '@/features/plans/revalidationStore';
import { describeEntryDiff } from './describeEntryDiff';

interface RevalidationDetailSheetProps {
  locale: Locale;
  t: Translate;
  onClose: () => void;
}

export function RevalidationDetailSheet({
  locale,
  t,
  onClose,
}: RevalidationDetailSheetProps) {
  const run = useActiveRun();

  if (run?.report == null) {
    return null;
  }
  const entries = run.report.entries.filter(
    (entry) => entry.outcome !== 'unchanged',
  );

  return (
    <ModalDialog
      title={t('revalidation.detailTitle')}
      closeLabel={t('action.close')}
      onClose={onClose}
      width="narrow"
    >
      {entries.length === 0 ? (
        <p className="text-ink-soft">{t('revalidation.allMatch')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li
              key={entry.teachTableId}
              className="border-t border-border pt-2 first:border-t-0 first:pt-0"
            >
              <p className="font-semibold">
                {entry.subjectId} {t('section.code')} {entry.section}
              </p>
              {entry.outcome === 'missing' ? (
                <p className="text-danger">{t('verify.missing')}</p>
              ) : (
                <dl className="mt-1 flex flex-col gap-1">
                  {describeEntryDiff(entry, locale, t).map((row) => (
                    <div key={row.label} className="flex flex-col text-xs">
                      <dt className="text-ink-soft">{row.label}</dt>
                      <dd>
                        <span className="text-ink-soft line-through">
                          {row.old}
                        </span>{' '}
                        <span className="text-ink">{row.next}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </ModalDialog>
  );
}
