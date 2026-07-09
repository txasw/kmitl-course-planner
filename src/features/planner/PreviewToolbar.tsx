// The preview sharing toolbar. It is rendered only in preview mode and sits above
// the poster capture node, so its controls never appear in an exported image. For
// now it carries the download action; the clipboard and text actions and the
// display options popover arrive with the rest of the sharing surface. Every
// action reports through the shared toast, since a download or copy has no other
// visible result on screen.

import type { RefObject } from 'react';
import { Download } from 'lucide-react';
import { useActivePlan } from '@/features/plans/planStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { toastStore } from '@/features/shell/toastStore';
import { downloadBlob } from '@/lib/utils/download';
import { planExportBaseName } from '@/lib/planner/exportName';
import { capturePng } from './capture';
import { DisplayOptionsPopover } from './DisplayOptionsPopover';

interface PreviewToolbarProps {
  /** The poster node captured by the image actions. */
  posterRef: RefObject<HTMLDivElement | null>;
}

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-kcp border border-border px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none';

export function PreviewToolbar({ posterRef }: PreviewToolbarProps) {
  const { t } = useTranslation();
  const activePlan = useActivePlan();

  const handleDownloadPng = () => {
    const node = posterRef.current;
    if (node === null) {
      return;
    }
    const name = `${activePlan === null ? 'kmitl-plan' : planExportBaseName(activePlan)}.png`;
    void capturePng(node).then(
      (blob) => {
        downloadBlob(name, blob);
        toastStore.getState().show('success', t('preview.pngDownloaded'));
      },
      () => {
        toastStore.getState().show('error', t('preview.exportFailed'));
      },
    );
  };

  return (
    <div
      role="toolbar"
      aria-label={t('preview.toolbar')}
      className="flex shrink-0 flex-wrap items-center gap-2"
    >
      <DisplayOptionsPopover />
      <button type="button" onClick={handleDownloadPng} className={BUTTON}>
        <Download size={16} strokeWidth={2} aria-hidden />
        {t('preview.downloadPng')}
      </button>
    </div>
  );
}
