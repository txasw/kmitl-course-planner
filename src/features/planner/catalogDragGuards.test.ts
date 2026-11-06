import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import type * as CatalogVisibility from '@/features/shell/catalogVisibility';
import {
  CATALOG_COLUMN_ID,
  finishCatalogSlide,
} from '@/features/shell/catalogVisibility';
import { makeSection } from '../../../tests/support/domain-builders';
import { mayAutoScroll, settleCatalogSlide } from './catalogDragGuards';
import { dragStore } from './dragStore';

// jsdom has no Web Animations API, so the slide itself is out of reach; the guard is
// checked for finishing it in the right root.
vi.mock('@/features/shell/catalogVisibility', async (importOriginal) => ({
  ...(await importOriginal<typeof CatalogVisibility>()),
  finishCatalogSlide: vi.fn(),
}));

function mountColumn(): HTMLElement {
  const column = document.createElement('div');
  column.id = CATALOG_COLUMN_ID;
  const scroller = document.createElement('div');
  column.append(scroller);
  document.body.append(column);
  return scroller;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.mocked(finishCatalogSlide).mockClear();
  act(() => {
    dragStore.getState().clearBlockMove();
  });
});

describe('mayAutoScroll', () => {
  it('lets the catalog scroll except under a block drag', () => {
    const scroller = mountColumn();
    const grid = document.createElement('div');
    document.body.append(grid);
    expect(mayAutoScroll(scroller)).toBe(true);

    const section = makeSection({ teachTableId: 'b1' });
    act(() => {
      dragStore.getState().startBlockMove(section, [section], null);
    });
    expect(mayAutoScroll(scroller)).toBe(false);
    expect(mayAutoScroll(grid)).toBe(true);
  });
});

describe('settleCatalogSlide', () => {
  it('finishes the catalog slide in the root of the element the drag began on', () => {
    const handle = document.createElement('button');
    document.body.append(handle);
    const event = new MouseEvent('mousedown', { bubbles: true });
    handle.dispatchEvent(event);

    settleCatalogSlide(event);
    expect(finishCatalogSlide).toHaveBeenCalledWith(document);
  });

  it('leaves a drag with no activator target alone', () => {
    settleCatalogSlide(null);
    settleCatalogSlide(new MouseEvent('mousedown'));
    expect(finishCatalogSlide).not.toHaveBeenCalled();
  });
});
