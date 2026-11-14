// The preview sharing toolbar. It is rendered only in preview mode and sits above
// the poster capture node, so its controls never appear in an exported image. It
// carries the display options popover and the sharing actions: copy the poster
// image, download it, and copy the plan as plain text. Every action reports through
// the shared toast, since a copy or download has no other visible result on screen.
// Copy image is feature detected; where the browser lacks image clipboard support
// the control is replaced by a one line note pointing at the always present
// download, never a dead button. JSON export and import live in the plan menu, not
// here, because they are data management rather than visual sharing. The verification
// status ends the toolbar row, so an offline or partial check and its retry stay in
// view while sharing (brief section 6.6 step 6, ADR-0060), and the pre share notice
// follows the toolbar, both outside the capture node, when the plan holds entries to
// review before sharing.
//
// An image capture takes a moment on a large template, so while one runs the toolbar is
// busy: the action that started it reads as creating the image with a spinner, and every
// sharing action is marked disabled and ignores presses, so a second press cannot start a
// parallel capture. The actions use aria-disabled rather than disabled so the focused
// button keeps focus through the capture.

import { useState, type ReactNode, type RefObject } from 'react';
import { Clipboard, ClipboardCopy, Download, LoaderCircle } from 'lucide-react';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { ExamSchedule } from '@/lib/planner/examSchedule';
import { formatPlanText } from '@/lib/export/planText';
import { downloadBlob } from '@/lib/utils/download';
import { planExportBaseName } from '@/lib/planner/exportName';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import { useActivePlan } from '@/features/plans/planStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { toastStore } from '@/features/shell/toastStore';
import { capturePng } from './capture';
import { DisplayOptionsPopover } from './DisplayOptionsPopover';
import { examScheduleLines } from './examScheduleLines';
import { PreShareNotice } from './PreShareNotice';
import { VerificationStatus } from './VerificationStatus';
import type { PlacedSection } from './placedSection';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';

interface PreviewToolbarProps {
  /** The poster node captured by the image actions. */
  posterRef: RefObject<HTMLDivElement | null>;
  /** The chosen export template: the capture pixel ratio and the file name slug. */
  template: ExportTemplate;
  /** The placed sections, for the plain text export. */
  sections: PlacedSection[];
  /** The active display options, applied to the text export as to the poster. */
  displayOptions: DisplayOptions;
  /** The plan's exam schedule, which the text export appends when the option is on. */
  examSchedule: ExamSchedule;
}

const BUTTON = `inline-flex items-center gap-1.5 rounded-kcp border border-border px-2.5 py-1.5 text-sm text-ink hover:bg-surface-alt aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent ${TARGET_SIZE} ${FOCUS_RING}`;

/** The image action whose capture is running, or null when the toolbar is idle. */
type Capturing = 'copyImage' | 'download' | null;

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
  template,
  sections,
  displayOptions,
  examSchedule,
}: PreviewToolbarProps) {
  const { t, language } = useTranslation();
  const activePlan = useActivePlan();

  const base =
    activePlan === null ? 'kmitl-plan' : planExportBaseName(activePlan);
  const fileName = `${base}-${template.slug}.png`;

  const [capturing, setCapturing] = useState<Capturing>(null);
  const busy = capturing !== null;

  // Capture the poster, hand the image to its destination, and toast the outcome, holding
  // the toolbar busy from the press until the outcome is known.
  const runCapture = (
    action: Exclude<Capturing, null>,
    deliver: (blob: Blob) => Promise<void> | void,
    successMessage: string,
  ) => {
    const node = posterRef.current;
    if (node === null || busy) {
      return;
    }
    setCapturing(action);
    void capturePng(node, template.pixelRatio)
      .then(deliver)
      .then(
        () => {
          toastStore.getState().show('success', successMessage);
        },
        () => {
          toastStore.getState().show('error', t('preview.exportFailed'));
        },
      )
      .finally(() => {
        setCapturing(null);
      });
  };

  const handleDownloadPng = () => {
    runCapture(
      'download',
      (blob) => {
        downloadBlob(fileName, blob);
      },
      t('preview.pngDownloaded'),
    );
  };

  const handleCopyImage = () => {
    runCapture(
      'copyImage',
      (blob) =>
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
      t('preview.imageCopied'),
    );
  };

  // The label of an image action: its own while idle, creating the image while its capture
  // runs, so the busy state names what is happening where the student pressed.
  const actionLabel = (
    action: Exclude<Capturing, null>,
    icon: ReactNode,
    label: string,
  ) =>
    capturing === action ? (
      <>
        <LoaderCircle
          size={16}
          strokeWidth={2}
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
        {t('preview.capturing')}
      </>
    ) : (
      <>
        {icon}
        {label}
      </>
    );

  const handleCopyText = () => {
    if (busy) {
      return;
    }
    const text = formatPlanText({
      planName: activePlan?.name ?? t('plan.untitled'),
      year: activePlan?.year ?? '',
      semester: activePlan?.semester ?? '',
      sections,
      exams: examScheduleLines(examSchedule, displayOptions, language, t),
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
    <>
      <div
        role="toolbar"
        aria-label={t('preview.toolbar')}
        aria-busy={busy}
        className="flex shrink-0 flex-wrap items-end gap-2"
      >
        <DisplayOptionsPopover />
        {canCopyImage() ? (
          <button
            type="button"
            onClick={handleCopyImage}
            aria-disabled={busy}
            className={BUTTON}
          >
            {actionLabel(
              'copyImage',
              <Clipboard size={16} strokeWidth={2} aria-hidden />,
              t('preview.copyImage'),
            )}
          </button>
        ) : (
          <span className="text-xs text-ink-soft">
            {t('preview.copyImageUnsupported')}
          </span>
        )}
        <button
          type="button"
          onClick={handleDownloadPng}
          aria-disabled={busy}
          className={BUTTON}
        >
          {actionLabel(
            'download',
            <Download size={16} strokeWidth={2} aria-hidden />,
            t('preview.downloadPng'),
          )}
        </button>
        <button
          type="button"
          onClick={handleCopyText}
          aria-disabled={busy}
          className={BUTTON}
        >
          <ClipboardCopy size={16} strokeWidth={2} aria-hidden />
          {t('preview.copyText')}
        </button>
        <span className="ml-auto self-center text-xs">
          <VerificationStatus />
        </span>
      </div>
      <PreShareNotice />
    </>
  );
}
