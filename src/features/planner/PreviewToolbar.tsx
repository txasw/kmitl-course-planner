// The preview sharing toolbar. It is rendered only in preview mode and sits outside
// the poster capture node, so its controls never appear in an exported image. It
// carries the display options and the sharing actions: share the poster
// image through the native share sheet, copy it, download it, and copy the plan as
// plain text. A copy or download reports through the shared toast, since it has no
// other visible result on screen. Copy image is feature detected; where the browser
// lacks image clipboard support the control is replaced by a one line note pointing
// at the always present download, never a dead button. Share image is feature
// detected too and is simply absent where the browser cannot share a file, since
// download and copy remain. JSON export and import live in the plan menu, not
// here, because they are data management rather than visual sharing. The verification
// status ends the toolbar row, so an offline or partial check and its retry stay in
// view while sharing (brief section 6.6 step 6, ADR-0060), and the pre share notice
// follows the toolbar, both outside the capture node, when the plan holds entries to
// review before sharing.
//
// Download is the one primary action of the export page and the only filled button, labelled
// at every width (ADR-0022 amendment of 2026-11-21); share, copy image, copy as text, and the
// display options are outline buttons with visible labels, each with its own glyph, so no two
// actions look alike. From 640 px up the toolbar heads the poster as one row that leads with
// download and wraps where the labels need it, and the display options open as an inline panel
// under that row, pushing the chips and the stage down (ADR-0027 amendment). Below 640 px the
// panel renders the toolbar under the poster, along the panel foot in the thumb zone: download
// fills its own row, and the other actions share the row under it as equal cells, each a glyph
// over a short label that wraps rather than clips. The verification status and any copy image note move to their own
// lines above the actions, and the pre share notice precedes the toolbar there, so the
// actions stay nearest the edge.
//
// An image capture takes a moment on a large template, so while one runs the toolbar is
// busy: the action that started it reads as creating the image with a spinner, and every
// sharing action is marked disabled and ignores presses, so a second press cannot start a
// parallel capture. The capture and its delivery live in useImageActions.

import type { RefObject } from 'react';
import {
  Download,
  FileText,
  ImageIcon,
  LoaderCircle,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { ExamSchedule } from '@/lib/planner/examSchedule';
import { formatPlanText } from '@/lib/export/planText';
import { planExportBaseName } from '@/lib/planner/exportName';
import type { ExportTemplate } from '@/lib/planner/exportTemplates';
import { useActivePlan } from '@/features/plans/planStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { copyText } from '@/features/shell/copyText';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import {
  DisplayOptionsPanel,
  DisplayOptionsSheet,
  DisplayOptionsToggle,
  useDisplayOptionsDisclosure,
} from './DisplayOptions';
import { examScheduleLines } from './examScheduleLines';
import { PreShareNotice } from './PreShareNotice';
import { PreviewToolbarAction, toolbarIconSize } from './PreviewToolbarAction';
import { canShareImage } from './imageShare';
import {
  SHARE_IMAGE_ID,
  canCopyImage,
  useImageActions,
  type ImageAction,
} from './useImageActions';
import { VerificationStatus } from './VerificationStatus';
import type { PlacedSection } from './placedSection';

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

export function PreviewToolbar({
  posterRef,
  template,
  sections,
  displayOptions,
  examSchedule,
}: PreviewToolbarProps) {
  const { t, language } = useTranslation();
  const activePlan = useActivePlan();
  const compact = useLayoutTier() === 'compact';
  const {
    open: optionsOpen,
    panelId,
    triggerRef,
    panelRef,
    toggle: toggleOptions,
  } = useDisplayOptionsDisclosure();
  const iconProps = {
    size: toolbarIconSize(compact),
    strokeWidth: 2,
    'aria-hidden': true,
  } as const;

  const base =
    activePlan === null ? 'kmitl-plan' : planExportBaseName(activePlan);
  const fileName = `${base}-${template.slug}.png`;

  const { capturing, download, copyImage, share } = useImageActions(
    posterRef,
    template.pixelRatio,
    fileName,
  );
  const busy = capturing !== null;

  // An image action reads as itself while idle and as creating the image while its capture
  // runs, so the busy state names what is happening where the student pressed.
  const imageAction = (
    action: ImageAction,
    icon: LucideIcon,
    labels: { label: string; shortLabel?: string },
    onClick: () => void,
  ) => {
    const running = capturing === action;
    const Icon = running ? LoaderCircle : icon;
    return (
      <PreviewToolbarAction
        icon={
          <Icon
            {...iconProps}
            className={
              running ? 'animate-spin motion-reduce:animate-none' : undefined
            }
          />
        }
        {...(running ? { label: t('preview.capturing') } : labels)}
        compact={compact}
        weight={action === 'download' ? 'primary' : 'secondary'}
        busy={busy}
        onClick={onClick}
        {...(action === 'share' ? { id: SHARE_IMAGE_ID } : {})}
      />
    );
  };

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
    copyText(text, t('preview.textCopied'), t('preview.copyTextFailed'));
  };

  const shareAction = canShareImage()
    ? imageAction(
        'share',
        Share2,
        { label: t('preview.shareImage'), shortLabel: t('preview.shareShort') },
        share,
      )
    : null;
  const copyImageAction = canCopyImage()
    ? imageAction(
        'copyImage',
        ImageIcon,
        { label: t('preview.copyImage') },
        copyImage,
      )
    : null;
  const copyImageNote =
    copyImageAction === null ? (
      <span className="text-xs text-ink-soft">
        {t('preview.copyImageUnsupported')}
      </span>
    ) : null;
  const downloadAction = imageAction(
    'download',
    Download,
    { label: t('preview.downloadPng') },
    download,
  );
  const secondary = (
    <>
      {shareAction}
      {copyImageAction ?? (compact ? null : copyImageNote)}
      <PreviewToolbarAction
        icon={<FileText {...iconProps} />}
        label={t('preview.copyText')}
        compact={compact}
        weight="secondary"
        busy={busy}
        onClick={handleCopyText}
      />
      {compact ? (
        <DisplayOptionsSheet />
      ) : (
        <DisplayOptionsToggle
          open={optionsOpen}
          controls={panelId}
          buttonRef={triggerRef}
          onToggle={toggleOptions}
        />
      )}
    </>
  );
  const toolbarProps = {
    role: 'toolbar',
    'aria-label': t('preview.toolbar'),
    'aria-busy': busy,
  } as const;

  if (compact) {
    return (
      <>
        <PreShareNotice />
        <div {...toolbarProps} className="flex shrink-0 flex-col gap-2">
          <span className="self-start text-xs empty:hidden">
            <VerificationStatus />
          </span>
          {copyImageNote}
          {downloadAction}
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            {secondary}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        {...toolbarProps}
        className="flex shrink-0 flex-wrap items-center gap-2"
      >
        {downloadAction}
        {secondary}
        <span className="ml-auto self-center text-xs">
          <VerificationStatus />
        </span>
      </div>
      <DisplayOptionsPanel
        id={panelId}
        open={optionsOpen}
        panelRef={panelRef}
      />
      <PreShareNotice />
    </>
  );
}
