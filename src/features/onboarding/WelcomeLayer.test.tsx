import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { uiStore } from '@/features/shell/uiStore';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { WelcomeLayer } from './WelcomeLayer';

function setWelcomeOpen(open: boolean): void {
  act(() => {
    onboardingStore.getState().setWelcomeOpen(open);
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setLanguage('th');
  });
  onboardingStore.setState(initialOnboardingData());
  document.documentElement.style.overflow = '';
});

describe('WelcomeLayer', () => {
  it('is absent from the DOM while the welcome is closed', () => {
    const { container } = render(<WelcomeLayer />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the welcome in its own portal node at the host layer', () => {
    setWelcomeOpen(true);
    const { container } = render(<WelcomeLayer />);
    const dialog = screen.getByRole('dialog');
    const layer = container.firstElementChild;
    expect(layer).toHaveClass('fixed', 'inset-0', 'z-host');
    expect(layer).toContainElement(dialog);
  });

  it('carries the panel language', () => {
    setWelcomeOpen(true);
    render(<WelcomeLayer />);
    expect(screen.getByRole('dialog').closest('[lang]')).toHaveAttribute(
      'lang',
      'th',
    );
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(screen.getByRole('dialog').closest('[lang]')).toHaveAttribute(
      'lang',
      'en',
    );
  });

  it('locks host scroll while open and restores it on close', () => {
    document.documentElement.style.overflow = 'auto';
    render(<WelcomeLayer />);
    expect(document.documentElement.style.overflow).toBe('auto');
    setWelcomeOpen(true);
    expect(document.documentElement.style.overflow).toBe('hidden');
    setWelcomeOpen(false);
    expect(document.documentElement.style.overflow).toBe('auto');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
