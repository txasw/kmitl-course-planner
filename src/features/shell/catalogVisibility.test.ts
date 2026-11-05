import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { dragStore } from '@/features/planner/dragStore';
import { makeSection } from '../../../tests/support/domain-builders';
import {
  CATALOG_HIDE_ID,
  CATALOG_RAIL_ID,
  POINTER_TOGGLE_GUARD_MS,
  hideCatalog,
  showCatalog,
} from './catalogVisibility';
import { uiStore } from './uiStore';

// The pointer guard keeps its last toggle time in module scope, so each test starts its
// clock well past the previous test's window instead of resetting the module.
let clock = 0;

function advance(ms: number): void {
  clock += ms;
}

function mountControls(): { rail: HTMLButtonElement; hide: HTMLButtonElement } {
  const rail = document.createElement('button');
  rail.id = CATALOG_RAIL_ID;
  const hide = document.createElement('button');
  hide.id = CATALOG_HIDE_ID;
  document.body.append(rail, hide);
  return { rail, hide };
}

beforeEach(() => {
  advance(10_000);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  dragStore.getState().clearBlockMove();
  uiStore.getState().setCatalogVisible(true);
});

describe('catalog visibility funnel', () => {
  it('hides the column and focuses the rail, then shows it and focuses the hide control', () => {
    const { rail, hide } = mountControls();
    hideCatalog(hide, 0);
    expect(uiStore.getState().catalogVisible).toBe(false);
    expect(rail).toHaveFocus();

    showCatalog(rail, 0);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(hide).toHaveFocus();
  });

  it('focuses a named target when showing the column', () => {
    const { rail } = mountControls();
    const course = document.createElement('div');
    course.id = 'kcp-course-target';
    course.tabIndex = -1;
    document.body.append(course);
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 0, course.id);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(course).toHaveFocus();
  });

  it.each([0, 1])(
    'does nothing while a block move is in flight, at detail %i',
    (detail) => {
      const { rail, hide } = mountControls();
      const section = makeSection({ teachTableId: 'p' });
      dragStore.getState().startBlockMove(section, [section], null);

      hideCatalog(hide, detail);
      expect(uiStore.getState().catalogVisible).toBe(true);

      uiStore.getState().setCatalogVisible(false);
      showCatalog(rail, detail);
      expect(uiStore.getState().catalogVisible).toBe(false);
    },
  );

  it('ends a double click on the rail with the column shown', () => {
    const { rail, hide } = mountControls();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 1);
    expect(uiStore.getState().catalogVisible).toBe(true);
    // The second click of the pair lands on the hide control at the same point.
    advance(POINTER_TOGGLE_GUARD_MS + 50);
    hideCatalog(hide, 2);
    expect(uiStore.getState().catalogVisible).toBe(true);
  });

  it('ignores a second pointer toggle inside the window but not a keyboard one', () => {
    const { rail, hide } = mountControls();
    uiStore.getState().setCatalogVisible(false);
    showCatalog(rail, 1);
    advance(POINTER_TOGGLE_GUARD_MS - 1);
    hideCatalog(hide, 1);
    expect(uiStore.getState().catalogVisible).toBe(true);

    hideCatalog(hide, 0);
    expect(uiStore.getState().catalogVisible).toBe(false);
  });

  it('accepts a pointer toggle once the window has passed', () => {
    const { rail, hide } = mountControls();
    hideCatalog(hide, 1);
    advance(POINTER_TOGGLE_GUARD_MS);
    showCatalog(rail, 1);
    expect(uiStore.getState().catalogVisible).toBe(true);
  });
});
