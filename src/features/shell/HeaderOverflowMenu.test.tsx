import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { HeaderOverflowMenu } from './HeaderOverflowMenu';
import { Overlay } from './Overlay';
import { uiStore } from './uiStore';

const MORE = 'ตัวเลือกเพิ่มเติม';

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: MORE });
}

function item(name: string): HTMLElement {
  return screen.getByRole('menuitemradio', { name });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
});

describe('HeaderOverflowMenu', () => {
  it('names a collapsed menu button', () => {
    render(<HeaderOverflowMenu />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click with focus on the first item and the language checked', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.click(trigger());
    const menu = screen.getByRole('menu', { name: MORE });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', menu.id);
    expect(
      screen.getByRole('group', { name: 'เลือกภาษา' }),
    ).toBeInTheDocument();
    expect(item('ไทย')).toHaveFocus();
    expect(item('ไทย')).toHaveAttribute('aria-checked', 'true');
    expect(item('English')).toHaveAttribute('aria-checked', 'false');
  });

  it('opens on ArrowUp with focus on the last item', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(item('English')).toHaveFocus();
  });

  it('moves between items with the arrow keys, Home, and End', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(item('ไทย')).toHaveFocus();
    fireEvent.keyDown(item('ไทย'), { key: 'ArrowDown' });
    expect(item('English')).toHaveFocus();
    fireEvent.keyDown(item('English'), { key: 'ArrowDown' });
    expect(item('ไทย')).toHaveFocus();
    fireEvent.keyDown(item('ไทย'), { key: 'ArrowUp' });
    expect(item('English')).toHaveFocus();
    fireEvent.keyDown(item('English'), { key: 'Home' });
    expect(item('ไทย')).toHaveFocus();
    fireEvent.keyDown(item('ไทย'), { key: 'End' });
    expect(item('English')).toHaveFocus();
  });

  it('applies a choice, closes, and returns focus to the trigger', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.click(trigger());
    fireEvent.click(item('English'));
    expect(uiStore.getState().language).toBe('en');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
  });

  it('closes on Tab without moving focus back', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.click(trigger());
    fireEvent.keyDown(item('ไทย'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape back to the trigger and leaves the overlay open', () => {
    installViewport(390, { reducedMotion: true });
    act(() => {
      uiStore.getState().open();
    });
    function wrapper({ children }: { children: ReactNode }) {
      return (
        <SearchDepsProvider value={fakeSearchDeps()}>
          {children}
        </SearchDepsProvider>
      );
    }
    render(<Overlay />, { wrapper });
    fireEvent.click(trigger());
    expect(item('ไทย')).toHaveFocus();

    fireEvent.keyDown(item('ไทย'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(uiStore.getState().isOpen).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // With the menu closed, the next Escape belongs to the overlay again.
    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(uiStore.getState().isOpen).toBe(false);
  });
});
