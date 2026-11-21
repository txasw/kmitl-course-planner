// The display options of the export page. They set the poster options, which apply to the
// preview and every export, so the choices persist through the ui store and its preferences
// hook. The name language leads as a three way choice, Thai, English, or both, selected on the
// panel language until the student picks one; the switches follow, trimmed to the fields a
// whole field fit can still change: the room, the section, the subject id, and the exam
// schedule (ADR-0046 amendment of 2026-11-20).
//
// From 640 px up the options are a disclosure: the toolbar button toggles an inline panel
// under the toolbar row, which pushes the template chips and the stage down rather than float
// over them, so no chip, poster line, or toolbar status is ever cut at a layer edge (ADR-0027
// amendment of 2026-11-21). The button carries aria-expanded and aria-controls, the panel
// stays in the DOM while hidden so the reference always resolves, and Escape from the button
// or the panel closes it only, returning focus to the button and leaving the overlay open.
// Below 640 px the options open in a modal bottom sheet with its own scrim instead, so they
// take the full width under a thumb, and the trigger is a cell of the phone action row like
// the other secondary actions there, its glyph over the short label ตัวเลือก or Options, with
// the full name kept as its accessible name.

import { useCallback, useId, useRef, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { SlidersHorizontal } from 'lucide-react';
import type { DisplayToggle } from '@/lib/planner/displayOptions';
import {
  effectiveNameLanguage,
  NAME_LANGUAGES,
  type NameLanguage,
} from '@/lib/planner/nameLanguage';
import type { TranslationKey } from '@/lib/i18n/t';
import { uiStore } from '@/features/shell/uiStore';
import { useEscapeLayer } from '@/features/shell/useEscapeLayer';
import { useTranslation } from '@/features/shell/useTranslation';
import { BottomSheet } from '@/components/BottomSheet';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Switch } from '@/components/Switch';
import { toolbarActionClass, toolbarIconSize } from './PreviewToolbarAction';

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

/** The open state and the two nodes of the inline display options disclosure. */
interface DisplayOptionsDisclosure {
  open: boolean;
  panelId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  toggle: () => void;
}

/** Holds the inline disclosure, closing it on Escape from its button or its panel. */
export function useDisplayOptionsDisclosure(): DisplayOptionsDisclosure {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  useEscapeLayer(triggerRef, close, open);
  useEscapeLayer(panelRef, close, open);
  return { open, panelId, triggerRef, panelRef, toggle };
}

/** The name language choice, with its note under both. */
function NameLanguageField() {
  const { t, language } = useTranslation();
  const choice = useStore(
    uiStore,
    (state) => state.displayOptions.nameLanguage,
  );
  const nameLanguage = effectiveNameLanguage(choice, language);
  // Under both, a note says the second name yields to the block fit where a block is short, so
  // a block that shows one name is no surprise, and that the copied text always carries both.
  // The column aligns to the start so the segmented group hugs its three options rather than
  // drawing its border across the full width.
  return (
    <div className="flex flex-col items-start gap-1 px-2 pt-1 pb-1.5">
      <span className="text-xs font-semibold text-ink-soft">
        {t('preview.nameLanguage')}
      </span>
      <SegmentedControl
        ariaLabel={t('preview.nameLanguage')}
        value={nameLanguage}
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
  );
}

/** The display option switches. */
function OptionSwitches() {
  const { t } = useTranslation();
  const displayOptions = useStore(uiStore, (state) => state.displayOptions);
  return (
    <>
      {OPTIONS.map((option) => (
        <Switch
          key={option.key}
          checked={displayOptions[option.key]}
          label={t(option.labelKey)}
          onChange={(checked) => {
            uiStore.getState().setDisplayOption(option.key, checked);
          }}
        />
      ))}
    </>
  );
}

function OptionsGlyph({ compact }: { compact: boolean }) {
  return (
    <SlidersHorizontal
      size={toolbarIconSize(compact)}
      strokeWidth={2}
      aria-hidden
    />
  );
}

/** The toolbar button that shows and hides the inline panel from 640 px up. */
export function DisplayOptionsToggle({
  open,
  controls,
  buttonRef,
  onToggle,
}: {
  open: boolean;
  /** The id of the panel the button shows and hides. */
  controls: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      className={toolbarActionClass('secondary', false)}
      onClick={onToggle}
    >
      <OptionsGlyph compact={false} />
      <span>{t('preview.displayOptions')}</span>
    </button>
  );
}

/**
 * The inline panel under the toolbar row. The name language and the switches share one row
 * where the width allows and wrap under each other where it does not, so the panel stays short
 * and the stage below keeps its height.
 */
export function DisplayOptionsPanel({
  id,
  open,
  panelRef,
}: {
  id: string;
  open: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <div
      ref={panelRef}
      id={id}
      role="region"
      aria-label={t('preview.displayOptions')}
      hidden={!open}
      className="shrink-0 rounded-kcp border border-border bg-surface p-1.5"
    >
      {open ? (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
          <NameLanguageField />
          <div className="grid min-w-0 flex-1 basis-80 grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-x-2 gap-y-0.5">
            <OptionSwitches />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The phone action row cell that opens the options in a modal bottom sheet. */
export function DisplayOptionsSheet() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <div className="relative flex min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('preview.displayOptions')}
        className={toolbarActionClass('secondary', true)}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <OptionsGlyph compact />
        <span>{t('preview.displayOptionsShort')}</span>
      </button>
      {open ? (
        <BottomSheet
          title={t('preview.displayOptions')}
          closeLabel={t('action.close')}
          onClose={close}
        >
          <div className="flex flex-col gap-1">
            <NameLanguageField />
            <OptionSwitches />
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
