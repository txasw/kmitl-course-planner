// The panel keyboard shortcuts: slash focuses the catalog filter, Ctrl or Cmd with Z
// undoes the last plan change while its undo toast is pending, and the question mark
// opens the shortcut help. They bind natively on the panel element, like the focus trap,
// because the panel sits inside the closed shadow root where a document listener never
// sees the keys, and host page scripts never see them either.
//
// A shortcut never takes a key the student is typing: a press in a text field, a select,
// a combobox, or an editable region is left alone, so slash and the question mark type
// as characters and Ctrl+Z keeps the field's own undo. Nothing fires while a popover,
// menu, sheet, or dialog is open, since that layer owns the keys, nor while a drag is in
// flight, since the drag owns the plan and the catalog. A modified press other than the
// undo chord is ignored, so browser shortcuts keep working. The keys are matched by the
// character first and by the physical key only when the layout produced no Latin
// character, so the shortcuts still answer under the Thai keyboard layout.

import { useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { LayoutTier } from '@/lib/ui/breakpoints';
import { revealCard } from '@/features/catalog/useRevealOnExpand';
import { dragStore, selectDragging } from '@/features/planner/dragStore';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { attentionStore } from './attentionStore';
import { CATALOG_FILTER_ID, revealCatalog } from './catalogVisibility';
import { rootOf } from './useFocusTrap';
import { useLayoutTier } from './useLayoutTier';
import { REDUCED_MOTION_QUERY } from './usePresence';

export type PanelShortcut = 'filter' | 'undo' | 'help';

/** Input types that take no typed text, so a shortcut may fire while one is focused. */
const NON_TEXT_INPUTS: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Roles whose element reads printable keys itself, such as a type ahead list. */
const KEY_READING_ROLES = '[role="combobox"],[role="listbox"],[role="textbox"]';

const EDITABLE_REGION = '[contenteditable]:not([contenteditable="false"])';

/** Whether a key press on this target belongs to a field the student types into. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(target.type);
  }
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return (
    target.closest(KEY_READING_ROLES) !== null ||
    target.closest(EDITABLE_REGION) !== null
  );
}

/** Whether the layout produced a character outside Latin letters and ASCII symbols. */
function isNonLatinKey(key: string): boolean {
  return key.length === 1 && key.charCodeAt(0) > 0x7f;
}

type ShortcutKeys = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
>;

/** The shortcut a key press asks for, or null when it asks for none. */
export function shortcutFor(event: ShortcutKeys): PanelShortcut | null {
  if (event.altKey) return null;
  const nonLatin = isNonLatinKey(event.key);
  if (event.ctrlKey || event.metaKey) {
    if (event.shiftKey || (event.ctrlKey && event.metaKey)) return null;
    const isZ =
      event.key.toLowerCase() === 'z' || (nonLatin && event.code === 'KeyZ');
    return isZ ? 'undo' : null;
  }
  const slashKey = nonLatin && event.code === 'Slash';
  if (event.key === '/' || (slashKey && !event.shiftKey)) return 'filter';
  if (event.key === '?' || (slashKey && event.shiftKey)) return 'help';
  return null;
}

/**
 * Bring the catalog into view and move focus to its filter field, scrolling the field
 * into the catalog's view. Below 640 px an open search form covers the results, so it
 * folds first, as a course reveal does. Returns false when no filter field is rendered,
 * which is before any search and in preview, so the key is left alone.
 */
function focusFilter(panel: HTMLElement, tier: LayoutTier): boolean {
  const field = rootOf(panel)?.getElementById(CATALOG_FILTER_ID);
  if (field === null || field === undefined) return false;
  if (tier === 'compact') {
    flushSync(() => {
      searchStore.getState().setSearchFormOpen(false);
    });
  }
  revealCatalog(panel, tier, CATALOG_FILTER_ID);
  revealCard(field, window.matchMedia(REDUCED_MOTION_QUERY).matches);
  return true;
}

/** Undo the pending plan change. Returns false when no undo record is pending. */
function undoPending(): boolean {
  const plans = planStore.getState();
  if (plans.pendingUndo === null) return false;
  plans.undo();
  return true;
}

interface PanelShortcutOptions {
  /** Whether the panel is open and mounted, so its keys are live. */
  enabled: boolean;
  /** Open the shortcut help. */
  onHelp: () => void;
}

export function usePanelShortcuts(
  panelRef: RefObject<HTMLElement | null>,
  { enabled, onHelp }: PanelShortcutOptions,
): void {
  const tier = useLayoutTier();
  const tierRef = useRef(tier);
  const helpRef = useRef(onHelp);

  // Keep the latest tier and callback without re-attaching the listener on every render.
  useEffect(() => {
    tierRef.current = tier;
    helpRef.current = onHelp;
  }, [tier, onHelp]);

  useEffect(() => {
    if (!enabled) return undefined;
    const panel = panelRef.current;
    if (panel === null) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return;
      const shortcut = shortcutFor(event);
      if (shortcut === null || isEditableTarget(event.target)) return;
      if (attentionStore.getState().openSurfaces > 0) return;
      if (selectDragging(dragStore.getState())) return;
      if (shortcut === 'help') {
        event.preventDefault();
        helpRef.current();
        return;
      }
      const handled =
        shortcut === 'filter'
          ? focusFilter(panel, tierRef.current)
          : undoPending();
      if (handled) event.preventDefault();
    };

    panel.addEventListener('keydown', handleKeyDown);
    return () => {
      panel.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, panelRef]);
}
