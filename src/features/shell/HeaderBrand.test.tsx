import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ExtensionVersionContext } from './ExtensionVersionContext';
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
    <ExtensionVersionContext.Provider value={version}>
      <HeaderBrand />
    </ExtensionVersionContext.Provider>,
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

  it('shows a debug suffix as the manifest states it', () => {
    const { container } = renderBrand('1.5.0-debug');
    expect(pill(container)).toHaveTextContent(/^v1\.5\.0-debug$/);
  });

  it('keeps the bare mark when the version is unreadable', () => {
    const { container } = renderBrand(null);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(pill(container)).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('sits in the header leading group before the title', () => {
    const { container } = render(
      <ExtensionVersionContext.Provider value="1.5.0">
        <Header titleId="title" />
      </ExtensionVersionContext.Provider>,
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
