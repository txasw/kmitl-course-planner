// The display options popover in the preview toolbar. It toggles the four poster
// options, which apply to the preview and every export, so the choices persist
// through the ui store and its preferences hook. It is positioned with floating-ui
// like the plan switcher, a fixed strategy that escapes the toolbar, dismisses on
// an outside click, and intercepts Escape so it closes only the popover rather than
// the whole overlay.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { SlidersHorizontal } from 'lucide-react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import type { DisplayOptions } from '@/lib/planner/displayOptions';
import type { TranslationKey } from '@/lib/i18n/t';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { FOCUS_RING } from '@/lib/ui/focus';
import { Switch } from '@/components/Switch';

const OPTIONS: { key: keyof DisplayOptions; labelKey: TranslationKey }[] = [
  { key: 'fitToContent', labelKey: 'preview.fitToContent' },
  { key: 'showRoom', labelKey: 'preview.showRoom' },
  { key: 'showSection', labelKey: 'preview.showSection' },
  { key: 'showEnglishNames', labelKey: 'preview.showEnglishNames' },
];

const TRIGGER = `inline-flex items-center gap-1.5 rounded-kcp border border-border px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-surface-alt ${FOCUS_RING}`;

export function DisplayOptionsPopover() {
  const { t } = useTranslation();
  const displayOptions = useStore(uiStore, (state) => state.displayOptions);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    strategy: 'fixed',
    placement: 'bottom-end',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
  ]);

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

  // The overlay closes on Escape through a panel listener that fires before
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
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={setReference}
        type="button"
        aria-expanded={open}
        className={TRIGGER}
        {...getReferenceProps()}
      >
        <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
        {t('preview.displayOptions')}
      </button>
      {open ? (
        <div
          ref={setFloating}
          style={floatingStyles}
          aria-label={t('preview.displayOptions')}
          className="z-10 flex min-w-48 flex-col gap-0.5 rounded-kcp border border-border bg-surface p-1.5 shadow-kcp"
          {...getFloatingProps()}
        >
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
        </div>
      ) : null}
    </div>
  );
}
