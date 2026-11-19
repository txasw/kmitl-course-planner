import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import {
  autosaveStore,
  PLAN_SWITCHER_TRIGGER_ID,
  type AutosaveStatus,
} from '@/features/plans/autosaveStore';
import { SaveIndicator } from './SaveIndicator';
import { uiStore } from './uiStore';

const RETRY = 'ยังไม่ได้บันทึก บันทึกอีกครั้ง';

function setStatus(status: AutosaveStatus, retry: () => void = vi.fn()) {
  act(() => {
    autosaveStore.getState().attach(retry);
    autosaveStore.getState().setStatus(status);
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    autosaveStore.getState().detach();
    uiStore.getState().setLanguage('th');
  });
});

describe('SaveIndicator', () => {
  it('renders nothing while autosave is off', () => {
    const { container } = render(<SaveIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing while a save is pending or once it lands', () => {
    for (const status of ['saving', 'saved'] as const) {
      setStatus(status);
      const { container, unmount } = render(<SaveIndicator />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it('appears when a save fails and leaves when the next one starts', () => {
    setStatus('saving');
    render(<SaveIndicator />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => {
      autosaveStore.getState().setStatus('failed');
    });
    expect(screen.getByRole('button', { name: RETRY })).toBeInTheDocument();
    act(() => {
      autosaveStore.getState().setStatus('saving');
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a retry in a danger state while the latest save failed', () => {
    const retry = vi.fn();
    setStatus('failed', retry);
    render(<SaveIndicator />);
    const button = screen.getByRole('button', { name: RETRY });
    expect(button).toHaveTextContent('ยังไม่ได้บันทึก');
    expect(button).toHaveAttribute('title', RETRY);
    expect(button).toHaveClass(
      'text-danger',
      'bg-danger-soft',
      'border-danger',
    );
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the word for a screen reader and shows the mark alone below 640 px', () => {
    setStatus('failed');
    render(<SaveIndicator />);
    expect(screen.getByText('ยังไม่ได้บันทึก')).toHaveClass(
      'sr-only',
      'sm:not-sr-only',
    );
  });

  it('is no live region, since its toast announces the failure', () => {
    setStatus('failed');
    const { container } = render(<SaveIndicator />);
    expect(
      container.querySelector('[aria-live], [role="status"], [role="alert"]'),
    ).toBeNull();
  });

  it('hands focus to the plan switcher when pressing retry makes it leave', () => {
    const retry = vi.fn(() => {
      autosaveStore.getState().setStatus('saving');
    });
    setStatus('failed', retry);
    render(
      <>
        <button type="button" id={PLAN_SWITCHER_TRIGGER_ID}>
          switcher
        </button>
        <SaveIndicator />
      </>,
    );
    const button = screen.getByRole('button', { name: RETRY });
    act(() => {
      button.focus();
    });
    fireEvent.click(button);
    expect(button).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'switcher' })).toHaveFocus();
  });

  it('leaves focus alone when the indicator did not hold it', () => {
    setStatus('failed');
    render(
      <>
        <button type="button" id={PLAN_SWITCHER_TRIGGER_ID}>
          switcher
        </button>
        <button type="button">elsewhere</button>
        <SaveIndicator />
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' });
    act(() => {
      elsewhere.focus();
    });
    act(() => {
      autosaveStore.getState().setStatus('saved');
    });
    expect(elsewhere).toHaveFocus();
  });

  it('speaks English when the panel does', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    setStatus('failed');
    render(<SaveIndicator />);
    expect(
      screen.getByRole('button', { name: 'Not saved, save again' }),
    ).toHaveTextContent('Not saved');
  });
});
