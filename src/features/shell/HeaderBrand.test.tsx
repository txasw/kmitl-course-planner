import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { extensionChrome } from '@/entrypoints/regis.content/extensionChrome';
import {
  DEFAULT_SHELL_CHROME,
  ShellChromeContext,
  type ShellChrome,
} from './ShellChromeContext';
import { HeaderBrand } from './HeaderBrand';
import { Header } from './Header';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setLanguage('th');
  });
});

function renderBrand(version: string | null) {
  return render(
    <ShellChromeContext.Provider value={extensionChrome(version)}>
      <HeaderBrand />
    </ShellChromeContext.Provider>,
  );
}

function pill(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[aria-hidden="true"].rounded-full');
}

describe('HeaderBrand', () => {
  it('attaches the version pill to the mark from the sm tier, hidden from the accessibility tree', () => {
    const { container } = renderBrand('1.5.0');
    const brand = container.firstElementChild;
    expect(brand).toHaveClass('relative', 'hidden', 'size-6', 'sm:block');
    expect(brand?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const tag = pill(container);
    expect(tag).toHaveTextContent(/^v1\.5\.0$/);
    // Out of flow at the bottom right, so the 24 px box and the row beside it never move.
    expect(tag).toHaveClass('absolute', '-right-1', '-bottom-2');
    // Quiet metadata: small tabular figures in the muted ink on the surface fill.
    expect(tag).toHaveClass(
      'text-[10px]',
      'tabular-nums',
      'text-ink-muted',
      'bg-surface',
      'border',
      'border-border',
      'rounded-full',
      'whitespace-nowrap',
      'pointer-events-none',
    );
  });

  it('names the version as a phrase for a screen reader in each language', () => {
    renderBrand('1.5.0');
    expect(screen.getByText('KCP เวอร์ชัน 1.5.0')).toHaveClass('sr-only');
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(screen.getByText('KCP version 1.5.0')).toHaveClass('sr-only');
  });

  it('shows a four part version as the manifest states it', () => {
    const { container } = renderBrand('1.5.0.2');
    expect(pill(container)).toHaveTextContent(/^v1\.5\.0\.2$/);
  });

  it('keeps the bare mark when the version is unreadable', () => {
    const { container } = renderBrand(null);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(pill(container)).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders whatever badge the chrome gives, with no values to fill', () => {
    // Stand in keys whose text is known, to show the brand renders the keys it is
    // given rather than the version keys.
    const chrome: ShellChrome = {
      ...DEFAULT_SHELL_CHROME,
      badge: {
        pill: 'language.en',
        line: 'language.en',
        phrase: 'language.th',
        values: {},
      },
    };
    const { container } = render(
      <ShellChromeContext.Provider value={chrome}>
        <HeaderBrand />
      </ShellChromeContext.Provider>,
    );
    expect(pill(container)).toHaveTextContent(/^English$/);
    expect(screen.getByText('ไทย')).toHaveClass('sr-only');
  });

  it('sits in the header leading group before the title', () => {
    const { container } = render(
      <ShellChromeContext.Provider value={extensionChrome('1.5.0')}>
        <Header titleId="title" />
      </ShellChromeContext.Provider>,
    );
    const leading = container.querySelector('header > div');
    const brand = leading?.firstElementChild;
    expect(brand?.querySelector('svg')).not.toBeNull();
    expect(brand).toHaveTextContent('v1.5.0');
    expect(brand?.nextElementSibling).toBe(
      screen.getByRole('heading', { level: 2 }),
    );
    // The dialog name stays the title alone; the version is not part of it.
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent(
      '1.5.0',
    );
  });
});
