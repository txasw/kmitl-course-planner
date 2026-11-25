// The more menu of the helper card, after the menu button pattern: the trigger opens the
// menu with focus on its first item, the arrow keys, Home, and End move between items,
// and Escape closes it back to the trigger without collapsing the card. It holds the
// actions a student needs once or rarely: add every subject still to add in one run, open
// the planner, read the page again, turn add for me off or on, and hide the helper on
// this page. Add all for me is a student press like Add for me, so only the fill controls
// render it; when it cannot run it stays in the menu with its reason under its label.
// Check again sits here and on the bar of a page KCP cannot read, so the student can ask
// for a fresh reading whenever the card looks behind the page.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  CalendarDays,
  Check,
  Ellipsis,
  EyeOff,
  ListPlus,
  RefreshCw,
} from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import { stillToAdd } from '@/lib/regis/helperStatus';
import { FOCUS_RING } from '@/lib/ui/focus';
import { focusFirst } from '@/features/shell/restoreFocus';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { AddAllMenuItem } from './fill/FillControls';
import { hideHelper, setCurrent, setView } from './helperStore';
import { hostStore } from './host/hostStore';
import { regisStore } from './regisStore';
import { useAddAllBlock } from './useAddBlock';
import { useHelperFloating } from './useHelperFloating';
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

/**
 * Add all for me: a press starts one run over every subject still to add. A run puts the
 * card in view with no subject pinned, so the focus follows the subject being added and
 * its condition can show before the grade dialog is acknowledged. When it cannot run, the
 * item keeps its place with the reason under its label, and a press shows the reason.
 */
function AddAllItem({
  model,
  onDone,
  t,
}: {
  model: HelperModel;
  onDone: () => void;
  t: Translate;
}) {
  const reasonId = useId();
  const order = model.checklist?.rows ?? [];
  const ids = new Set(
    stillToAdd(
      order.map((row) => row.subjectId),
      model.statuses,
    ),
  );
  const rows = order.filter((row) => ids.has(row.subjectId));
  const { block, reason } = useAddAllBlock(model, rows, t);
  const { plan, kit } = model;
  if (rows.length === 0 || model.sent) return null;
  const label = t('regis.addAll');
  const icon = (
    <span aria-hidden className="flex shrink-0 text-ink-soft">
      <ListPlus size={16} />
    </span>
  );
  if (block === null && plan !== null && kit !== null) {
    return (
      <AddAllMenuItem
        rows={rows}
        plan={plan}
        kit={kit}
        label={label}
        onStart={() => {
          onDone();
          setCurrent(null);
          setView('card');
        }}
        className={ITEM}
      >
        {icon}
        <span className="min-w-0">{label}</span>
      </AddAllMenuItem>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled="true"
      // The reason under the label is its description, not part of its name.
      aria-label={label}
      aria-describedby={reasonId}
      onClick={() => {
        toastStore.getState().show('error', reason);
      }}
      className={`${ITEM} cursor-not-allowed text-ink-muted`}
    >
      {icon}
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        <span id={reasonId} className="text-xs text-ink-soft">
          {reason}
        </span>
      </span>
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
  // The menu hangs below the trigger at its end edge, over the card, and flips above it
  // or shifts sideways when a short screen has no room there.
  const { setReference, setFloating, floatingStyles } = useHelperFloating(
    open,
    'bottom-end',
  );
  const setTrigger = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      setReference(node);
    },
    [setReference],
  );
  const setMenu = useCallback(
    (node: HTMLDivElement | null) => {
      menuRef.current = node;
      setFloating(node);
    },
    [setFloating],
  );
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
        ref={setTrigger}
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
          ref={setMenu}
          style={floatingStyles}
          className="kcp-scroll z-popover min-w-44 overflow-y-auto rounded-kcp border border-border bg-surface p-1 shadow-kcp kcp-fade-in"
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
            {pre ? (
              <AddAllItem
                model={model}
                onDone={() => {
                  setOpen(false);
                }}
                t={t}
              />
            ) : null}
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
                icon={<RefreshCw size={16} />}
                label={t('regis.recheck')}
                onSelect={() => {
                  close();
                  hostStore.getState().recheck();
                }}
              />
            ) : null}
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
