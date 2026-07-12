// The preview sharing toolbar. It is rendered only in preview mode and sits above
// the poster capture node, so its controls never appear in an exported image. It
// carries the display options popover and the sharing actions: copy the poster
// image, download it, and copy the plan as plain text. Every action reports through
// the shared toast, since a copy or download has no other visible result on screen.
// Copy image is feature detected; where the browser lacks image clipboard support
// the control is replaced by a one line note pointing at the always present
// download, never a dead button. JSON export and import live in the plan menu, not
// here, because they are data management rather than visual sharing.

import type { RefObject } from 'react';
import { Clipboard, ClipboardCopy, Download } from 'lucide-react';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import { formatPlanText } from '@/lib/export/planText';
import { downloadBlob } from '@/lib/utils/download';
import { planExportBaseName } from '@/lib/planner/exportName';
import { useActivePlan } from '@/features/plans/planStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { toastStore } from '@/features/shell/toastStore';
import { capturePng } from './capture';
import { DisplayOptionsPopover } from './DisplayOptionsPopover';
import type { PlacedSection } from './placedSection';
import { FOCUS_RING } from '@/lib/ui/focus';

interface PreviewToolbarProps {
  /** The poster node captured by the image actions. */
  posterRef: RefObject<HTMLDivElement | null>;
  /** The placed sections, for the plain text export. */
  sections: PlacedSection[];
  /** The active display options, applied to the text export as to the poster. */
  displayOptions: DisplayOptions;
}

const BUTTON = `inline-flex items-center gap-1.5 rounded-kcp border border-border px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-surface-alt ${FOCUS_RING}`;

/** Whether the browser can write an image to the clipboard. The host is a secure
 * context, so navigator.clipboard is present; ClipboardItem is the real gate. */
function canCopyImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard.write === 'function'
  );
}

export function PreviewToolbar({
  posterRef,
  sections,
  displayOptions,
}: PreviewToolbarProps) {
  const { t, language } = useTranslation();
  const activePlan = useActivePlan();

  const fileBase =
    activePlan === null ? 'kmitl-plan' : planExportBaseName(activePlan);

  const notifyExportFailed = () => {
    toastStore.getState().show('error', t('preview.exportFailed'));
  };

  const handleDownloadPng = () => {
    const node = posterRef.current;
    if (node === null) {
      return;
    }
    void capturePng(node).then((blob) => {
      downloadBlob(`${fileBase}.png`, blob);
      toastStore.getState().show('success', t('preview.pngDownloaded'));
    }, notifyExportFailed);
  };

  const handleCopyImage = () => {
    const node = posterRef.current;
    if (node === null) {
      return;
    }
    void capturePng(node).then((blob) => {
      void navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => {
          toastStore.getState().show('success', t('preview.imageCopied'));
        }, notifyExportFailed);
    }, notifyExportFailed);
  };

  const handleCopyText = () => {
    const text = formatPlanText({
      planName: activePlan?.name ?? t('plan.untitled'),
      year: activePlan?.year ?? '',
      semester: activePlan?.semester ?? '',
      sections,
      options: displayOptions,
      locale: language,
      t,
    });
    void navigator.clipboard.writeText(text).then(
      () => {
        toastStore.getState().show('success', t('preview.textCopied'));
      },
      () => {
        toastStore.getState().show('error', t('preview.copyTextFailed'));
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
      {canCopyImage() ? (
        <button type="button" onClick={handleCopyImage} className={BUTTON}>
          <Clipboard size={16} strokeWidth={2} aria-hidden />
          {t('preview.copyImage')}
        </button>
      ) : (
        <span className="text-xs text-ink-soft">
          {t('preview.copyImageUnsupported')}
        </span>
      )}
      <button type="button" onClick={handleDownloadPng} className={BUTTON}>
        <Download size={16} strokeWidth={2} aria-hidden />
        {t('preview.downloadPng')}
      </button>
      <button type="button" onClick={handleCopyText} className={BUTTON}>
        <ClipboardCopy size={16} strokeWidth={2} aria-hidden />
        {t('preview.copyText')}
      </button>
    </div>
  );
}
