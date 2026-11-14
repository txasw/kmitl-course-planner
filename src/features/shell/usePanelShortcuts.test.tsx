import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { planStore, type UndoRecord } from '@/features/plans/planStore';
import { dragStore } from '@/features/planner/dragStore';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { installViewport } from '../../../tests/support/viewport';
import { searchStore } from '@/features/search/searchStore';
import { attentionStore } from './attentionStore';
import { CATALOG_FILTER_ID } from './catalogVisibility';
import { uiStore } from './uiStore';
import {
  isEditableTarget,
  shortcutFor,
  usePanelShortcuts,
} from './usePanelShortcuts';

// A stand in for the overlay: the panel element the shortcuts bind to, a filter field
// under the catalog's id, and the kinds of control a press can start from.
function Panel({ withFilter = true }: { withFilter?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  usePanelShortcuts(ref, { enabled: true });
  return (
    <div ref={ref} data-testid="panel" tabIndex={-1}>
      <button type="button">plain control</button>
      <input type="checkbox" aria-label="toggle" />
      <input aria-label="name" />
      <textarea aria-label="note" />
      <select aria-label="term">
        <option>1</option>
      </select>
      <div
        role="combobox"
        tabIndex={0}
        aria-label="faculty"
        aria-controls="faculty-list"
        aria-expanded={false}
      />
      <div contentEditable suppressContentEditableWarning aria-label="rich">
        <span>text</span>
      </div>
      {withFilter ? (
        <input id={CATALOG_FILTER_ID} type="search" aria-label="filter" />
      ) : null}
    </div>
  );
}

function removeRecord(): UndoRecord {
  const entry = makePlanEntry({
    snapshot: makeSnapshot({ teachTableId: 'r1', subjectId: '90592033' }),
  });
  return { kind: 'remove', added: [], removed: [entry] };
}

function seedUndo(): void {
  act(() => {
    seedActivePlan([]);
    planStore.setState({ pendingUndo: removeRecord() });
  });
}

function press(target: Element, init: KeyboardEventInit): boolean {
  return fireEvent.keyDown(target, init);
}

const UNDO = { key: 'z', code: 'KeyZ', ctrlKey: true };

beforeEach(() => {
  installViewport(1366);
  resetPlanStore();
});

afterEach(() => {
  cleanup();
  dragStore.setState({ blockMove: null });
  resetPlanStore();
  vi.unstubAllGlobals();
});

describe('shortcutFor', () => {
  const base = {
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  };

  it('reads slash, the question mark, and the undo chord', () => {
    expect(shortcutFor({ ...base, key: '/' })).toBe('filter');
    expect(shortcutFor({ ...base, key: '?', shiftKey: true })).toBe('help');
    expect(shortcutFor({ ...base, key: 'z', ctrlKey: true })).toBe('undo');
    expect(shortcutFor({ ...base, key: 'z', metaKey: true })).toBe('undo');
  });

  it('reads the physical keys when the Thai layout produces Thai characters', () => {
    expect(shortcutFor({ ...base, key: 'ฝ', code: 'Slash' })).toBe('filter');
    expect(
      shortcutFor({ ...base, key: 'ฦ', code: 'Slash', shiftKey: true }),
    ).toBe('help');
    expect(
      shortcutFor({ ...base, key: 'ผ', code: 'KeyZ', ctrlKey: true }),
    ).toBe('undo');
  });

  it('ignores redo, Alt chords, plain letters, and other modified keys', () => {
    expect(
      shortcutFor({ ...base, key: 'Z', ctrlKey: true, shiftKey: true }),
    ).toBeNull();
    expect(shortcutFor({ ...base, key: '/', altKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: '1', altKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: 'z' })).toBeNull();
    expect(shortcutFor({ ...base, key: '/', ctrlKey: true })).toBeNull();
    expect(
      shortcutFor({ ...base, key: 'z', ctrlKey: true, metaKey: true }),
    ).toBeNull();
    expect(
      shortcutFor({ ...base, key: 'y', code: 'KeyZ', ctrlKey: true }),
    ).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('treats text fields, selects, comboboxes, and editable regions as editable', () => {
    render(<Panel />);
    expect(isEditableTarget(screen.getByLabelText('name'))).toBe(true);
    expect(isEditableTarget(screen.getByLabelText('note'))).toBe(true);
    expect(isEditableTarget(screen.getByLabelText('term'))).toBe(true);
    expect(isEditableTarget(screen.getByLabelText('faculty'))).toBe(true);
    expect(isEditableTarget(screen.getByText('text'))).toBe(true);
    expect(isEditableTarget(screen.getByLabelText('filter'))).toBe(true);
  });

  it('treats buttons, checkboxes, and the panel itself as not editable', () => {
    render(<Panel />);
    expect(
      isEditableTarget(screen.getByRole('button', { name: 'plain control' })),
    ).toBe(false);
    expect(isEditableTarget(screen.getByLabelText('toggle'))).toBe(false);
    expect(isEditableTarget(screen.getByTestId('panel'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('usePanelShortcuts', () => {
  it('focuses the catalog filter on slash and keeps the character out', () => {
    render(<Panel />);
    const control = screen.getByRole('button', { name: 'plain control' });
    control.focus();
    expect(press(control, { key: '/', code: 'Slash' })).toBe(false);
    expect(document.activeElement).toBe(screen.getByLabelText('filter'));
  });

  it('folds the search form and shows the catalog pane below 640 px', () => {
    vi.unstubAllGlobals();
    installViewport(390);
    const before = {
      searchFormOpen: searchStore.getState().searchFormOpen,
      mobilePane: uiStore.getState().mobilePane,
    };
    act(() => {
      searchStore.setState({ searchFormOpen: true });
      uiStore.setState({ mobilePane: 'plan' });
    });
    render(<Panel />);
    const control = screen.getByRole('button', { name: 'plain control' });
    expect(press(control, { key: '/', code: 'Slash' })).toBe(false);
    expect(searchStore.getState().searchFormOpen).toBe(false);
    expect(uiStore.getState().mobilePane).toBe('catalog');
    expect(document.activeElement).toBe(screen.getByLabelText('filter'));
    act(() => {
      searchStore.setState({ searchFormOpen: before.searchFormOpen });
      uiStore.setState({ mobilePane: before.mobilePane });
    });
  });

  it('leaves slash alone when no filter field is rendered', () => {
    render(<Panel withFilter={false} />);
    const control = screen.getByRole('button', { name: 'plain control' });
    control.focus();
    expect(press(control, { key: '/', code: 'Slash' })).toBe(true);
    expect(document.activeElement).toBe(control);
  });

  it('types slash in a text field rather than moving focus', () => {
    render(<Panel />);
    for (const label of ['name', 'note', 'term', 'faculty']) {
      const field = screen.getByLabelText(label);
      field.focus();
      expect(press(field, { key: '/', code: 'Slash' })).toBe(true);
      expect(document.activeElement).toBe(field);
    }
  });

  it('undoes the pending change on Ctrl or Cmd with Z', () => {
    render(<Panel />);
    seedUndo();
    const control = screen.getByRole('button', { name: 'plain control' });
    expect(press(control, UNDO)).toBe(false);
    expect(planStore.getState().pendingUndo).toBeNull();
    expect(planStore.getState().entries).toHaveLength(1);

    seedUndo();
    expect(press(control, { key: 'z', code: 'KeyZ', metaKey: true })).toBe(
      false,
    );
    expect(planStore.getState().pendingUndo).toBeNull();
  });

  it('leaves the undo chord to the browser when nothing is pending', () => {
    render(<Panel />);
    act(() => {
      seedActivePlan([]);
    });
    const control = screen.getByRole('button', { name: 'plain control' });
    expect(press(control, UNDO)).toBe(true);
    expect(planStore.getState().entries).toHaveLength(0);
  });

  it('keeps the field undo while focus is in an editable field', () => {
    render(<Panel />);
    seedUndo();
    for (const label of ['name', 'note', 'filter']) {
      expect(press(screen.getByLabelText(label), UNDO)).toBe(true);
    }
    expect(press(screen.getByText('text'), UNDO)).toBe(true);
    expect(planStore.getState().pendingUndo).not.toBeNull();
  });

  it('stays quiet while a popover, menu, sheet, or dialog is open', () => {
    render(<Panel />);
    seedUndo();
    const release = attentionStore.getState().openSurface();
    const control = screen.getByRole('button', { name: 'plain control' });
    expect(press(control, UNDO)).toBe(true);
    expect(press(control, { key: '/', code: 'Slash' })).toBe(true);
    expect(planStore.getState().pendingUndo).not.toBeNull();
    expect(document.activeElement).not.toBe(screen.getByLabelText('filter'));
    release();
  });

  it('ignores a press while an input method is composing', () => {
    render(<Panel />);
    seedUndo();
    const control = screen.getByRole('button', { name: 'plain control' });
    expect(press(control, { ...UNDO, isComposing: true })).toBe(true);
    expect(planStore.getState().pendingUndo).not.toBeNull();
  });

  it('stays quiet while a drag is in flight', () => {
    render(<Panel />);
    seedUndo();
    const section = makeSection({ teachTableId: 'd1' });
    act(() => {
      dragStore.setState({
        blockMove: { section, group: [section], course: null, candidates: [] },
      });
    });
    const control = screen.getByRole('button', { name: 'plain control' });
    expect(press(control, UNDO)).toBe(true);
    expect(press(control, { key: '/', code: 'Slash' })).toBe(true);
    expect(planStore.getState().pendingUndo).not.toBeNull();
    expect(document.activeElement).not.toBe(screen.getByLabelText('filter'));
  });

  it('leaves a press another handler already took', () => {
    render(<Panel />);
    seedUndo();
    const control = screen.getByRole('button', { name: 'plain control' });
    const claim = (event: Event) => {
      event.preventDefault();
    };
    control.addEventListener('keydown', claim);
    press(control, UNDO);
    press(control, { key: '/', code: 'Slash' });
    control.removeEventListener('keydown', claim);
    expect(planStore.getState().pendingUndo).not.toBeNull();
    expect(document.activeElement).not.toBe(screen.getByLabelText('filter'));
  });
});
