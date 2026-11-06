import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { Launcher } from './Launcher';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
});

describe('Launcher', () => {
  it('renders an accessible launcher button in the default locale', () => {
    render(<Launcher />);
    const button = screen.getByRole('button', {
      name: 'เปิด Course Planner for KMITL',
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Planner');
  });

  it('opens the overlay when activated', () => {
    render(<Launcher />);
    fireEvent.click(
      screen.getByRole('button', { name: 'เปิด Course Planner for KMITL' }),
    );
    expect(uiStore.getState().isOpen).toBe(true);
  });

  it('localizes the label when the language is English', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<Launcher />);
    expect(
      screen.getByRole('button', { name: 'Open Course Planner for KMITL' }),
    ).toBeInTheDocument();
  });

  it('carries the active language for its label', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('lang', 'th');
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(button).toHaveAttribute('lang', 'en');
  });

  it('keeps its corner offset or the device safe area inset, whichever is larger', () => {
    render(<Launcher />);
    expect(screen.getByRole('button')).toHaveClass(
      'right-[max(20px,var(--kcp-safe-right))]',
      'bottom-[max(20px,var(--kcp-safe-bottom))]',
    );
  });
});
