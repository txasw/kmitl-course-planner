import { BrandMark } from '@/components/BrandMark';
import { fillTemplate } from '@/lib/i18n/template';
import { useShellChrome } from './ShellChromeContext';
import { useTranslation } from './useTranslation';

// The header brand mark from 640 px, with the chrome's badge, such as the extension
// version, as a quiet pill on its bottom right corner. The box keeps the mark's 24 px
// square, so the pill never changes the header height or moves the plan switcher: it is
// positioned out of flow, lies over the lower edge of the icon, and reaches only into
// the header padding on the left and a few pixels of the 12 px gap on the right, never
// over the title or the switcher. It is small, muted, and on the surface fill so it
// reads as metadata, not a control. The pill is aria-hidden and a screen reader reads
// the badge phrase instead. Below 640 px the mark is hidden and the overflow menu shows
// the badge line.
export function HeaderBrand() {
  const { badge } = useShellChrome();
  const { t } = useTranslation();
  return (
    <span className="relative hidden size-6 shrink-0 sm:block">
      <BrandMark className="size-6 text-primary" />
      {badge === null ? null : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-1 -bottom-2 rounded-full border border-border bg-surface px-1 text-[10px] leading-3.5 whitespace-nowrap text-ink-muted tabular-nums"
          >
            {fillTemplate(t(badge.pill), badge.values)}
          </span>
          <span className="sr-only">
            {fillTemplate(t(badge.phrase), badge.values)}
          </span>
        </>
      )}
    </span>
  );
}
