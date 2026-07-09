// The revalidation detail sheet, opened from the banner. It lists the entries a check
// changed or could not find, with old versus new values, so the one line summary can
// be expanded. It is a modal over the panel and dismisses on the backdrop, the close
// control, or Escape, which is intercepted so it does not close the whole overlay.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = panelRef.current;
    if (node === null) {
      return undefined;
    }
    node.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (run?.report == null) {
    return null;
  }
  const entries = run.report.entries.filter(
    (entry) => entry.outcome !== 'unchanged',
  );

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/30 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('revalidation.detailTitle')}
        tabIndex={-1}
        className="kcp-scroll max-h-[80vh] w-full max-w-md overflow-y-auto rounded-kcp border border-border bg-surface p-4 text-sm text-ink shadow-kcp outline-none"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t('revalidation.detailTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close')}
            className="rounded-kcp p-1 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="mt-3 text-ink-soft">{t('revalidation.allMatch')}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {entries.map((entry) => (
              <li
                key={entry.teachTableId}
                className="border-t border-border pt-2 first:border-t-0 first:pt-0"
              >
                <p className="font-medium">
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
      </div>
    </div>
  );
}
