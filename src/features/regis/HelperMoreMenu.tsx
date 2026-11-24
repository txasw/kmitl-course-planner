// The more menu of the helper card, after the menu button pattern: the trigger opens the
// menu with focus on its first item, the arrow keys, Home, and End move between items,
// and Escape closes it back to the trigger without collapsing the card. It holds the
// actions a student needs rarely: open the planner, turn add for me off or on, and hide
// the helper on this page. Reading the page again sits on the bar of a page KCP cannot
// read, the one time it helps.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useStore } from 'zustand';
import { CalendarDays, Check, Ellipsis, EyeOff } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { focusFirst } from '@/features/shell/restoreFocus';
import { uiStore } from '@/features/shell/uiStore';
import { hideHelper } from './helperStore';
import { regisStore } from './regisStore';
import type { HelperModel } from './useHelperModel';
import { useOutsidePress } from './useOutsidePress';

export const ICON_BUTTON = `inline-flex size-8 shrink-0 items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink max-sm:size-11 pointer-coarse:size-11 ${FOCUS_RING}`;

const ITEM = `flex w-full min-h-8 items-center gap-2 rounded-kcp px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-alt max-sm:min-h-11 pointer-coarse:min-h-11 ${FOCUS_RING}`;

function Item({
  icon,
  label,
  onSelect,
  checked,
}: {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  /** Set on a check item, whose icon shows only while it is on. */
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      tabIndex={-1}
      onClick={onSelect}
      className={ITEM}
    >
      <span
        aria-hidden
        className={`flex shrink-0 ${checked === undefined ? 'text-ink-soft' : 'text-primary-strong'} ${checked === false ? 'invisible' : ''}`}
      >
        {icon}
      </span>
      <span className="min-w-0">{label}</span>
    </button>
  );
}

function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
  );
  const at = items.findIndex((item) => item === event.target);
  const last = items.length - 1;
  const moves: Partial<Record<string, number>> = {
    ArrowDown: at >= last ? 0 : at + 1,
    ArrowUp: at <= 0 ? last : at - 1,
    Home: 0,
    End: last,
  };
  const move = moves[event.key];
  if (move === undefined) return;
  event.preventDefault();
  focusFirst([items[move]]);
}

export function HelperMoreMenu({
  model,
  t,
}: {
  model: HelperModel;
  t: Translate;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const off = useStore(regisStore, (state) => state.fill.off);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeQuietly = useCallback(() => {
    setOpen(false);
  }, []);
  // The menu sits in the card, which rises above the page, so it opens upward from the
  // trigger.
  useOutsidePress(wrapperRef, open, closeQuietly);
  useEffect(() => {
    if (!open) return;
    focusFirst([
      menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]'),
    ]);
  }, [open]);

  const close = () => {
    setOpen(false);
    focusFirst([triggerRef.current]);
  };
  const pre = model.route === 'preRegistration';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        aria-label={t('regis.more')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={ICON_BUTTON}
      >
        <Ellipsis size={18} aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 bottom-full z-popover mb-1 min-w-44 rounded-kcp border border-border bg-surface p-1 shadow-kcp kcp-fade-in"
        >
          <div
            id={menuId}
            role="menu"
            tabIndex={-1}
            aria-label={t('regis.more')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
              }
              if (event.key === 'Tab') setOpen(false);
              handleMenuKeyDown(event);
            }}
          >
            <Item
              icon={<CalendarDays size={16} />}
              label={t('regis.openPlanner')}
              onSelect={() => {
                setOpen(false);
                uiStore.getState().open();
              }}
            />
            {pre ? (
              <Item
                icon={<Check size={16} />}
                label={t('regis.fill.switch')}
                checked={!off}
                onSelect={() => {
                  regisStore.getState().setFillOff(!off);
                }}
              />
            ) : null}
            <div
              role="separator"
              className="mx-1 my-1 border-t border-border"
            />
            <Item
              icon={<EyeOff size={16} />}
              label={t('regis.hideHere')}
              onSelect={() => {
                setOpen(false);
                hideHelper();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
