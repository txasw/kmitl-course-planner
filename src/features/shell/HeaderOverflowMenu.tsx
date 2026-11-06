// The header overflow menu below 1024 px, where the header has no room for the language
// toggle. It follows the menu button pattern: the trigger opens a menu and moves focus to
// the first item, or to the last on ArrowUp; the arrow keys, Home, and End move between
// items; choosing an item applies it, closes the menu, and returns focus to the trigger.
// The language choice is a pair of menuitemradio items, so the current language is
// announced as checked and shown with a check mark rather than by colour alone. Escape
// closes the menu only, through useEscapeLayer, and returns focus to the trigger, so the
// overlay behind it stays open. Tab or a press outside closes it and lets focus move on.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { Check, MoreHorizontal } from 'lucide-react';
import { useDismiss, useInteractions } from '@floating-ui/react';
import type { Locale } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { uiStore } from './uiStore';
import { useEscapeLayer } from './useEscapeLayer';
import { usePanelPopover } from './usePanelPopover';
import { useTranslation } from './useTranslation';

const LOCALES: readonly Locale[] = ['th', 'en'];

/** Where focus lands when the menu opens: the first item, or the last for ArrowUp. */
type OpenFocus = 'first' | 'last';

export function HeaderOverflowMenu() {
  const { t } = useTranslation();
  const language = useStore(uiStore, (state) => state.language);
  const setLanguage = useStore(uiStore, (state) => state.setLanguage);
  const [openFocus, setOpenFocus] = useState<OpenFocus | null>(null);
  const open = openFocus !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const groupLabelId = useId();

  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 4,
    open,
    onOpenChange: (next) => {
      if (!next) setOpenFocus(null);
    },
    placement: 'bottom-end',
  });
  // Escape is routed through useEscapeLayer below, so the dismiss hook handles only a
  // press outside the menu.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, { escapeKey: false }),
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

  const closeToTrigger = useCallback(() => {
    setOpenFocus(null);
    triggerRef.current?.focus();
  }, []);

  useEscapeLayer(wrapperRef, closeToTrigger, open);

  // Move focus into the menu once its items have mounted.
  useEffect(() => {
    if (openFocus === null) return;
    const items = itemRefs.current;
    const target = openFocus === 'first' ? items[0] : items[items.length - 1];
    target?.focus();
  }, [openFocus]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpenFocus(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]',
      ),
    );
    // The key lands on the focused item. The panel sits in a shadow root, where the
    // document's activeElement is the host, so the event target names the item.
    const current = items.findIndex((item) => item === event.target);
    const last = items.length - 1;
    const nextIndex: Partial<Record<string, number>> = {
      ArrowDown: current >= last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    const index = nextIndex[event.key];
    if (index !== undefined) {
      event.preventDefault();
      items[index]?.focus();
      return;
    }
    if (event.key === 'Tab') {
      setOpenFocus(null);
    }
  };

  const choose = (locale: Locale) => {
    setLanguage(locale);
    closeToTrigger();
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={setReference}
        type="button"
        {...getReferenceProps({
          onClick: () => {
            setOpenFocus(open ? null : 'first');
          },
          onKeyDown: handleTriggerKeyDown,
        })}
        aria-label={t('header.more')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`inline-flex items-center justify-center rounded-kcp p-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink ${
          open ? 'bg-surface-alt text-ink' : ''
        } ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        <MoreHorizontal size={20} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          ref={setFloating}
          id={menuId}
          role="menu"
          aria-label={t('header.more')}
          style={floatingStyles}
          {...getFloatingProps({ onKeyDown: handleMenuKeyDown })}
          className="z-popover min-w-44 rounded-kcp border border-border bg-surface p-1 text-sm shadow-kcp"
        >
          <div role="group" aria-labelledby={groupLabelId}>
            <div
              id={groupLabelId}
              className="px-2 pt-1 pb-0.5 text-2xs text-ink-soft"
            >
              {t('language.select')}
            </div>
            {LOCALES.map((locale, index) => {
              const checked = locale === language;
              return (
                <button
                  key={locale}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={-1}
                  lang={locale}
                  onClick={() => {
                    choose(locale);
                  }}
                  className={`flex w-full items-center gap-2 rounded-kcp px-2 py-1.5 text-left text-ink hover:bg-surface-alt ${
                    checked ? 'font-semibold' : ''
                  } ${TARGET_SIZE} ${FOCUS_RING}`}
                >
                  <Check
                    size={16}
                    strokeWidth={2}
                    aria-hidden
                    className={`shrink-0 text-primary-strong ${checked ? '' : 'invisible'}`}
                  />
                  {t(`language.${locale}`)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
