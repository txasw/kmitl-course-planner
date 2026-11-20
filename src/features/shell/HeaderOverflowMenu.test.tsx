import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { debugMenuStore } from './debugMenuStore';
import { ExtensionVersionContext } from './ExtensionVersionContext';
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
    expect(screen.getByRole('group', { name: 'เลือกภาษา' })).toBeInTheDocument();
    expect(item('ไทย')).toHaveFocus();
    expect(item('ไทย')).toHaveAttribute('aria-checked', 'true');
    expect(item('English')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders no debug menu item in a production build', () => {
    act(() => {
      debugMenuStore
        .getState()
        .setItem({ label: 'Diagnostics', onSelect: vi.fn() });
    });
    render(<HeaderOverflowMenu />);
    fireEvent.click(trigger());
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    act(() => {
      debugMenuStore.getState().setItem(null);
    });
  });

  it('marks each language with its flag beside its name', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.click(trigger());
    for (const name of ['ไทย', 'English']) {
      const flag = item(name).querySelector('svg:not(.lucide)');
      expect(flag, name).not.toBeNull();
      expect(flag).toHaveAttribute('aria-hidden', 'true');
      expect(item(name)).toHaveTextContent(name);
    }
    // The check mark, not the flag, tells the current language apart.
    expect(item('ไทย').querySelector('.lucide')).not.toHaveClass('invisible');
    expect(item('English').querySelector('.lucide')).toHaveClass('invisible');
  });

  it('opens on ArrowUp with focus on the last item', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(item('English')).toHaveFocus();
  });

  it('ends the popover with a muted version line outside the menu, shown below sm', () => {
    render(
      <ExtensionVersionContext.Provider value="1.5.0">
        <HeaderOverflowMenu />
      </ExtensionVersionContext.Provider>,
    );
    fireEvent.click(trigger());
    const menu = screen.getByRole('menu', { name: MORE });
    const visible = screen.getByText('KCP v1.5.0');
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    const line = visible.parentElement;
    expect(line).toHaveClass('sm:hidden', 'text-2xs', 'text-ink-muted');
    // The last thing in the popover, after the menu, and never an item or a tab stop.
    expect(line?.parentElement?.lastElementChild).toBe(line);
    expect(menu.contains(line ?? null)).toBe(false);
    expect(line?.querySelector('button, [tabindex]')).toBeNull();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(
      within(line ?? document.body).getByText('KCP เวอร์ชัน 1.5.0'),
    ).toHaveClass('sr-only');
  });

  it('reads the version line in English', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(
      <ExtensionVersionContext.Provider value="1.5.0.2">
        <HeaderOverflowMenu />
      </ExtensionVersionContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByText('KCP v1.5.0.2')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByText('KCP version 1.5.0.2')).toHaveClass('sr-only');
  });

  it('leaves the version line out when the version is unreadable', () => {
    render(<HeaderOverflowMenu />);
    fireEvent.click(trigger());
    expect(screen.queryByText(/KCP v/)).not.toBeInTheDocument();
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
