import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { ErrorBoundary } from './ErrorBoundary';
import { PanelRecoveryCard } from './PanelRecoveryCard';

const t = createTranslator('th');

afterEach(cleanup);

function Bomb({ explode }: { explode: boolean }) {
  if (explode) {
    throw new Error('boom');
  }
  return <div>safe content</div>;
}

/** React logs a caught render error to console.error; silence it for the throwing
 * cases so the test output stays clean, and restore it after. */
function withSilencedError(run: () => void): void {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    run();
  } finally {
    spy.mockRestore();
  }
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback when a child throws', () => {
    withSilencedError(() => {
      render(
        <ErrorBoundary fallback={() => <div>fallback</div>}>
          <Bomb explode />
        </ErrorBoundary>,
      );
    });
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });

  it('recovers when reset runs and the child no longer throws', () => {
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <ErrorBoundary
          fallback={(reset) => (
            <button
              type="button"
              onClick={() => {
                setExplode(false);
                reset();
              }}
            >
              retry
            </button>
          )}
        >
          <Bomb explode={explode} />
        </ErrorBoundary>
      );
    }
    withSilencedError(() => {
      render(<Harness />);
    });
    fireEvent.click(screen.getByText('retry'));
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('keeps a sibling of the boundary alive and shows the recovery card', () => {
    // This mirrors the App layout: the launcher is a sibling of the panel, so a
    // panel body crash leaves the launcher, and therefore the way back to the host,
    // untouched while the recovery card takes the panel body.
    withSilencedError(() => {
      render(
        <div>
          <button type="button">launcher</button>
          <ErrorBoundary
            fallback={(reset) => <PanelRecoveryCard t={t} onReload={reset} />}
          >
            <Bomb explode />
          </ErrorBoundary>
        </div>,
      );
    });
    expect(screen.getByText('launcher')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(t('panel.error.title'))).toBeInTheDocument();
  });
});

describe('PanelRecoveryCard', () => {
  it('fires the reload action from its button', () => {
    const onReload = vi.fn();
    render(<PanelRecoveryCard t={t} onReload={onReload} />);
    fireEvent.click(
      screen.getByRole('button', { name: t('panel.error.reload') }),
    );
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
