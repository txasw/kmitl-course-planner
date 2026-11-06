import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import { dragStore } from '@/features/planner/dragStore';
import { searchStore } from '@/features/search/searchStore';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { CATALOG_COLUMN_ID } from './CatalogColumn';
import {
  CATALOG_HIDE_ID,
  CATALOG_RAIL_ID,
  hideCatalog,
} from './catalogVisibility';
import { EdgeRail } from './EdgeRail';
import { uiStore } from './uiStore';

const catalog: NormalizedCatalog = {
  courses: [
    makeCourse({
      subjectId: '90000001',
      sections: [makeSection({ teachTableId: 't1', subjectId: '90000001' })],
    }),
    makeCourse({
      subjectId: '90000002',
      sections: [makeSection({ teachTableId: 't2', subjectId: '90000002' })],
    }),
  ],
  duplicateCount: 0,
  multiMeetingCount: 0,
  warnings: [],
};

function hideColumn(): void {
  act(() => {
    uiStore.getState().setCatalogVisible(false);
  });
}

function rail(): HTMLElement | null {
  return document.getElementById(CATALOG_RAIL_ID);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    dragStore.getState().clearBlockMove();
    searchStore.getState().setResult({ status: 'idle' }, null);
    uiStore.getState().setCatalogVisible(true);
    uiStore.getState().setViewMode('edit');
    uiStore.getState().setLanguage('th');
  });
});

describe('EdgeRail', () => {
  it.each([1024, 1280, 1536])(
    'renders at %i px in edit mode while the column is hidden',
    (width) => {
      installViewport(width);
      hideColumn();
      render(<EdgeRail />);
      const button = screen.getByRole('button', { name: 'แสดงรายวิชา' });
      expect(button).toHaveAttribute('id', CATALOG_RAIL_ID);
      expect(button).toHaveAttribute('aria-controls', CATALOG_COLUMN_ID);
      expect(button).toHaveClass('w-11', 'z-drawer');
    },
  );

  it('is absent while the docked column is shown', () => {
    installViewport(1440);
    render(<EdgeRail />);
    expect(rail()).toBeNull();
  });

  it.each([390, 768])('is absent at %i px', (width) => {
    installViewport(width);
    hideColumn();
    render(<EdgeRail />);
    expect(rail()).toBeNull();
  });

  it('is absent in preview', () => {
    installViewport(1440);
    hideColumn();
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    render(<EdgeRail />);
    expect(rail()).toBeNull();
  });

  it('names the result count and shows it as a chip', () => {
    installViewport(1440);
    hideColumn();
    act(() => {
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    render(<EdgeRail />);
    const button = screen.getByRole('button', {
      name: 'แสดงรายวิชา (พบ 2 รายวิชา)',
    });
    expect(button).toHaveTextContent('2');
    expect(button).toHaveTextContent('รายวิชา');
  });

  it('names a search in flight and shows a busy dot in place of the count', () => {
    installViewport(1440);
    hideColumn();
    act(() => {
      searchStore.getState().setResult({ status: 'loading' }, null);
    });
    render(<EdgeRail />);
    const button = screen.getByRole('button', {
      name: 'แสดงรายวิชา (กำลังค้นหา)',
    });
    const dot = button.querySelector('[data-rail-busy]');
    expect(dot).toHaveClass('animate-pulse', 'motion-reduce:animate-none');
  });

  it('follows the locale', () => {
    installViewport(1440);
    hideColumn();
    act(() => {
      uiStore.getState().setLanguage('en');
      searchStore
        .getState()
        .setResult({ status: 'ready', data: catalog }, null);
    });
    render(<EdgeRail />);
    expect(
      screen.getByRole('button', { name: 'Show courses (2 found)' }),
    ).toBeInTheDocument();
  });

  it('carries an action name with no expanded state and no title', () => {
    installViewport(1440);
    hideColumn();
    render(<EdgeRail />);
    const button = screen.getByRole('button', { name: 'แสดงรายวิชา' });
    expect(button).not.toHaveAttribute('aria-expanded');
    expect(button).not.toHaveAttribute('title');
  });

  it('takes no pointer events during a block move', () => {
    installViewport(1440);
    hideColumn();
    render(<EdgeRail />);
    const button = screen.getByRole('button', { name: 'แสดงรายวิชา' });
    expect(button).not.toHaveAttribute('data-dragging');
    expect(button).not.toHaveClass('pointer-events-none');

    const section = makeSection({ teachTableId: 'p' });
    act(() => {
      dragStore.getState().startBlockMove(section, [section], null);
    });
    expect(button).toHaveAttribute('data-dragging', 'true');
    expect(button).toHaveClass('pointer-events-none');

    act(() => {
      dragStore.getState().clearBlockMove();
    });
    expect(button).not.toHaveAttribute('data-dragging');
  });

  describe('peek hold after a hide', () => {
    // The hide control lives in the column, which this test does not render, so a bare
    // button with its id stands in as the control the funnel hides from.
    function renderWithHideControl(): HTMLButtonElement {
      installViewport(1440);
      render(
        <>
          <button type="button" id={CATALOG_HIDE_ID}>
            hide
          </button>
          <EdgeRail />
        </>,
      );
      const hide = document.getElementById(CATALOG_HIDE_ID);
      if (!(hide instanceof HTMLButtonElement)) {
        throw new Error('the hide control did not render');
      }
      return hide;
    }

    it('holds the peek off after a pointer hide until the pointer moves off the rail', () => {
      const hide = renderWithHideControl();
      act(() => {
        hideCatalog(hide, 1);
      });
      const button = rail();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('data-peek-held');

      if (button === null) throw new Error('the rail did not mount');
      fireEvent.pointerMove(button);
      expect(button).toHaveAttribute('data-peek-held');
      fireEvent.pointerMove(hide);
      expect(button).not.toHaveAttribute('data-peek-held');
    });

    it('leaves the peek armed after a keyboard hide', () => {
      const hide = renderWithHideControl();
      act(() => {
        hideCatalog(hide, 0);
      });
      expect(rail()).toHaveFocus();
      expect(rail()).not.toHaveAttribute('data-peek-held');
    });
  });

  it('carries the peek ghost as a hidden, inert child', () => {
    installViewport(1440);
    hideColumn();
    render(<EdgeRail />);
    const ghost = rail()?.querySelector('.kcp-rail-ghost');
    expect(rail()).toHaveClass('kcp-rail');
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    expect(ghost).toHaveClass('pointer-events-none', 'absolute', 'left-full');
  });
});
