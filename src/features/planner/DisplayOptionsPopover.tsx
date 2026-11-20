// The display options popover in the preview toolbar. It sets the poster options, which
// apply to the preview and every export, so the choices persist through the ui store
// and its preferences hook. The name language leads as a three way choice, Thai,
// English, or both, selected on the panel language until the student picks one; the
// switches follow, trimmed to the fields a whole field fit can still change: the room,
// the section, the subject id, and the exam schedule (ADR-0046 amendment of
// 2026-11-20). It is positioned with floating-ui like the plan switcher, a fixed
// strategy that escapes the toolbar, dismisses on an outside click, and intercepts
// Escape so it closes only the popover rather than the whole overlay. Below 640 px the
// options open in a bottom sheet instead, so they take the full width under a thumb and
// leave the poster in view above them, and the trigger is an icon button like the other
// toolbar actions there.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { SlidersHorizontal } from 'lucide-react';
import { useClick, useDismiss, useInteractions } from '@floating-ui/react';
import type { DisplayToggle } from '@/lib/planner/displayOptions';
import {
  effectiveNameLanguage,
  NAME_LANGUAGES,
  type NameLanguage,
} from '@/lib/planner/nameLanguage';
import type { TranslationKey } from '@/lib/i18n/t';
import { uiStore } from '@/features/shell/uiStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { BottomSheet } from '@/components/BottomSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Switch } from '@/components/Switch';
import {
  TOOLBAR_BUTTON,
  TOOLBAR_ICON_BUTTON,
  toolbarIconSize,
} from './PreviewToolbarAction';

// Fit to content is retired from the poster: the smart window (grid.ts) now decides the
// window and day run for every template. Show English names is retired too: the name
// language choice above the switches covers it in both panel languages.
const OPTIONS: { key: DisplayToggle; labelKey: TranslationKey }[] = [
  { key: 'showRoom', labelKey: 'preview.showRoom' },
  { key: 'showSection', labelKey: 'preview.showSection' },
  { key: 'showSubjectId', labelKey: 'preview.showSubjectId' },
  { key: 'showExams', labelKey: 'preview.showExams' },
];

const NAME_LANGUAGE_LABEL: Record<NameLanguage, TranslationKey> = {
  th: 'preview.nameLanguage.th',
  en: 'preview.nameLanguage.en',
  both: 'preview.nameLanguage.both',
};

export function DisplayOptionsPopover() {
  const { t, language } = useTranslation();
  const displayOptions = useStore(uiStore, (state) => state.displayOptions);
  const [open, setOpen] = useState(false);
  const sheet = useLayoutTier() === 'compact';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 4,
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
  });
  // The sheet portals outside the floating context, so an outside press dismiss would
  // read every tap inside it as outside; the sheet closes through its own scrim instead.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { enabled: !sheet }),
  ]);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
      refs.setReference(node);
      triggerRef.current = node;
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  // The overlay closes on Escape through a body listener that fires before
  // floating-ui's dismiss, so intercept Escape on the popover to close only it and
  // return focus to the trigger, keeping the overlay open.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const node = wrapperRef.current;
    if (node === null) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  const nameLanguage = effectiveNameLanguage(
    displayOptions.nameLanguage,
    language,
  );
  const switches = OPTIONS.map((option) => (
    <Switch
      key={option.key}
      checked={displayOptions[option.key]}
      label={t(option.labelKey)}
      onChange={(checked) => {
        uiStore.getState().setDisplayOption(option.key, checked);
      }}
    />
  ));
  // The name language heads the options. Under both, a note says the second name yields to
  // the block fit where a block is short, so a block that shows one name is no surprise, and
  // that the copied text always carries both. The column aligns to the start so the segmented
  // group hugs its three options rather than drawing its border across the full width.
  const options = (
    <>
      <div className="flex flex-col items-start gap-1 px-2 pt-1 pb-1.5">
        <span className="text-xs font-semibold text-ink-soft">
          {t('preview.nameLanguage')}
        </span>
        <SegmentedControl
          ariaLabel={t('preview.nameLanguage')}
          value={nameLanguage}
          variant="quiet"
          options={NAME_LANGUAGES.map((value) => ({
            value,
            label: t(NAME_LANGUAGE_LABEL[value]),
          }))}
          onChange={(value) => {
            uiStore.getState().setNameLanguage(value);
          }}
        />
        {nameLanguage === 'both' ? (
          <p className="max-w-64 text-xs text-ink-soft">
            {t('preview.nameLanguage.bothNote')}
          </p>
        ) : null}
      </div>
      {switches}
    </>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={setReference}
        type="button"
        aria-haspopup={sheet ? 'dialog' : undefined}
        aria-expanded={open}
        aria-label={sheet ? t('preview.displayOptions') : undefined}
        title={sheet ? t('preview.displayOptions') : undefined}
        className={sheet ? TOOLBAR_ICON_BUTTON : TOOLBAR_BUTTON}
        {...getReferenceProps()}
      >
        <SlidersHorizontal
          size={toolbarIconSize(sheet)}
          strokeWidth={2}
          aria-hidden
        />
        {sheet ? null : t('preview.displayOptions')}
      </button>
      {open && sheet ? (
        <BottomSheet
          title={t('preview.displayOptions')}
          closeLabel={t('action.close')}
          onClose={close}
        >
          <div className="flex flex-col gap-1">{options}</div>
        </BottomSheet>
      ) : null}
      {open && !sheet ? (
        <div
          ref={setFloating}
          style={floatingStyles}
          aria-label={t('preview.displayOptions')}
          className={`z-popover flex min-w-48 ${PANEL_POPOVER_SCROLL} flex-col gap-0.5 rounded-kcp border border-border bg-surface p-1.5 shadow-kcp`}
          {...getFloatingProps()}
        >
          {options}
        </div>
      ) : null}
    </div>
  );
}
