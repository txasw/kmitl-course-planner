import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import { searchStore } from '@/features/search/searchStore';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { CATALOG_COLUMN_ID } from './CatalogColumn';
import { CatalogToggle } from './CatalogToggle';
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

function showResult(): void {
  act(() => {
    searchStore.getState().setResult({ status: 'ready', data: catalog }, null);
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    searchStore.getState().setResult({ status: 'idle' }, null);
    uiStore.getState().setSheetOpen(false);
    uiStore.getState().setCatalogVisible(true);
    uiStore.getState().setViewMode('edit');
    uiStore.getState().setLanguage('th');
  });
});

describe('CatalogToggle', () => {
  it('keeps the icon and count visible below 640 px with the label as sr-only text', () => {
    installViewport(390);
    showResult();
    render(<CatalogToggle />);
    const toggle = screen.getByRole('button', { name: 'รายวิชา 2' });
    expect(within(toggle).getByText('รายวิชา')).toHaveClass('max-sm:sr-only');
    expect(within(toggle).getByText('2')).not.toHaveClass('max-sm:sr-only');
  });

  it('shows a visible label and puts the result count in its accessible name', () => {
    installViewport(768);
    showResult();
    render(<CatalogToggle />);
    const toggle = screen.getByRole('button', { name: 'รายวิชา 2' });
    expect(toggle).toHaveTextContent('รายวิชา');
    expect(toggle).toHaveTextContent('2');
    expect(toggle).toHaveAttribute('aria-controls', CATALOG_COLUMN_ID);
  });

  it('names itself by the label alone before any result', () => {
    installViewport(768);
    render(<CatalogToggle />);
    const toggle = screen.getByRole('button', { name: 'รายวิชา' });
    expect(toggle).toHaveTextContent(/^รายวิชา$/);
  });

  it('follows the locale', () => {
    installViewport(768);
    showResult();
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<CatalogToggle />);
    expect(
      screen.getByRole('button', { name: 'Courses 2' }),
    ).toBeInTheDocument();
  });

  it('opens and closes the sheet on the medium tier and shows the docked column for later', () => {
    installViewport(768);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<CatalogToggle />);
    const toggle = screen.getByRole('button', { name: 'รายวิชา' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(uiStore.getState().catalogVisible).toBe(true);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveClass('bg-surface-alt');
    fireEvent.click(toggle);
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it.each([
    [1024, true],
    [1280, true],
    [1536, true],
    [1024, false],
    [1280, false],
    [1536, false],
  ] as const)(
    'is absent at %i px with the docked column shown %s',
    (width, visible) => {
      installViewport(width);
      showResult();
      act(() => {
        uiStore.getState().setCatalogVisible(visible);
      });
      render(<CatalogToggle />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  it('is absent in preview', () => {
    installViewport(768);
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    render(<CatalogToggle />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
