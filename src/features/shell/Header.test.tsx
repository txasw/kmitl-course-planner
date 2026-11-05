import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { Header } from './Header';
import { uiStore } from './uiStore';
import { CATALOG_COLUMN_ID } from './CatalogColumn';
import { installViewport } from '../../../tests/support/viewport';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setCatalogVisible(true);
    uiStore.getState().setLanguage('th');
  });
});

describe('Header', () => {
  it('renders the title, plan switcher, and language toggle', () => {
    render(<Header titleId="title" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'title',
    );
    expect(
      screen.getByRole('button', { name: 'เลือกตาราง' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'เลือกภาษา' }),
    ).toBeInTheDocument();
  });

  it('closes the overlay from the close control', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Header titleId="title" />);
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('switches the language through the toggle', () => {
    render(<Header titleId="title" />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(uiStore.getState().language).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles the catalog sheet below the lg tier', () => {
    installViewport(768);
    render(<Header titleId="title" />);
    const toggle = screen.getByRole('button', { name: 'รายวิชา' });
    expect(toggle).toHaveAttribute('aria-controls', CATALOG_COLUMN_ID);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it('drops the sheet toggle where the catalog column is docked', () => {
    installViewport(1024);
    render(<Header titleId="title" />);
    expect(
      screen.queryByRole('button', { name: 'รายวิชา' }),
    ).not.toBeInTheDocument();
  });

  it('leaves a hidden docked column to the edge rail', () => {
    installViewport(1024);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<Header titleId="title" />);
    expect(
      screen.queryByRole('button', { name: 'รายวิชา' }),
    ).not.toBeInTheDocument();
  });
});
