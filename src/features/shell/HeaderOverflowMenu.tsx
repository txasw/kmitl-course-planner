// The header overflow menu, on every layout tier, and the one place the UI language is
// chosen, since a language is changed rarely and a header toggle spent room on every
// width. It follows the menu button pattern: the trigger opens a menu and moves focus to
// the first item, or to the last on ArrowUp; the arrow keys, Home, and End move between
// items; choosing an item applies it, closes the menu, and returns focus to the trigger.
// The language choice is a pair of menuitemradio items, each with its flag and its name,
// so the current language is announced as checked and shown with a check mark rather
// than by colour or by the flag alone. Escape closes the menu only, through
// useEscapeLayer, and returns focus to the trigger, so the overlay behind it stays open.
// Tab or a press outside closes it and lets focus move on. Below 640 px, where the
// header hides the brand mark and its version pill, a muted line under the menu shows
// the extension version. It sits in the popover but outside the menu role, so it is
// neither an item nor focusable, and a screen reader reads it as a phrase. A debug build
// adds one plain menu item after the languages, the entry to its diagnostics drawer, from
// the debug menu slot; production leaves the slot empty.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useStore } from 'zustand';
import { Check, MoreHorizontal } from 'lucide-react';
import { useDismiss, useInteractions } from '@floating-ui/react';
import { LanguageFlag } from '@/components/LanguageFlag';
import type { Locale, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { IS_DEBUG } from '@/lib/env';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { debugMenuStore } from './debugMenuStore';
import { useExtensionVersion } from './ExtensionVersionContext';
import { uiStore } from './uiStore';
import { useEscapeLayer } from './useEscapeLayer';
import { usePanelPopover } from './usePanelPopover';
import { useTranslation } from './useTranslation';

const LOCALES: readonly Locale[] = ['th', 'en'];

// Each language's own name, written out so every dictionary key is named in source.
const LANGUAGE_NAME: Record<Locale, TranslationKey> = {
  th: 'language.th',
  en: 'language.en',
};

/** Where focus lands when the menu opens: the first item, or the last for ArrowUp. */
type OpenFocus = 'first' | 'last';

export function HeaderOverflowMenu() {
  const { t } = useTranslation();
  const version = useExtensionVersion();
  const language = useStore(uiStore, (state) => state.language);
  const setLanguage = useStore(uiStore, (state) => state.setLanguage);
  const slotItem = useStore(debugMenuStore, (state) => state.item);
  const debugItem = IS_DEBUG ? slotItem : null;
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
        '[role="menuitemradio"], [role="menuitem"]',
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
          style={floatingStyles}
          {...getFloatingProps({ onKeyDown: handleMenuKeyDown })}
          className="z-popover min-w-44 rounded-kcp border border-border bg-surface p-1 text-sm shadow-kcp"
        >
          <div id={menuId} role="menu" aria-label={t('header.more')}>
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
                    <LanguageFlag locale={locale} />
                    <span className="min-w-0 break-words">
                      {t(LANGUAGE_NAME[locale])}
                    </span>
                  </button>
                );
              })}
            </div>
            {debugItem === null ? null : (
              <button
                ref={(node) => {
                  itemRefs.current[LOCALES.length] = node;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  setOpenFocus(null);
                  debugItem.onSelect();
                }}
                className={`mt-1 flex w-full items-center rounded-kcp border-t border-border px-2 py-1.5 text-left text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
              >
                {debugItem.label}
              </button>
            )}
          </div>
          {version === null ? null : (
            <p className="mx-1 mt-1 border-t border-border px-1 pt-1.5 pb-0.5 text-2xs break-words text-ink-muted tabular-nums sm:hidden">
              <span aria-hidden>
                {fillTemplate(t('header.versionLine'), { version })}
              </span>
              <span className="sr-only">
                {fillTemplate(t('header.version'), { version })}
              </span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
