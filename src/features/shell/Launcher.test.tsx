import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import {
  initialOnboardingData,
  onboardingStore,
} from '@/features/onboarding/onboardingStore';
import { Launcher } from './Launcher';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
    onboardingStore.setState(initialOnboardingData());
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

  it('is a full pill at least 48 px tall that lifts only without reduced motion', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass(
      'rounded-full',
      'bg-primary-strong',
      'min-h-12',
      'px-5',
      'motion-safe:hover:-translate-y-0.5',
      'motion-safe:focus-visible:-translate-y-0.5',
    );
    // The lift moves the pill only; the shadow stays at its one level.
    expect(button.className).not.toMatch(/hover:shadow|focus-visible:shadow/);
  });

  it('is interactive while neither the panel nor the welcome is open', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('inert');
    expect(button).not.toHaveAttribute('aria-hidden');
  });

  it('is inert and hidden while the panel is open', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    act(() => {
      uiStore.getState().open();
    });
    expect(button).toHaveAttribute('inert');
    expect(button).toHaveAttribute('aria-hidden', 'true');
  });

  it('is inert and hidden while the welcome is open, and interactive again after it closes', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    act(() => {
      onboardingStore.getState().setWelcomeOpen(true);
    });
    expect(button).toHaveAttribute('inert');
    expect(button).toHaveAttribute('aria-hidden', 'true');
    act(() => {
      onboardingStore.getState().setWelcomeOpen(false);
    });
    expect(button).not.toHaveAttribute('inert');
    expect(button).not.toHaveAttribute('aria-hidden');
  });
});
