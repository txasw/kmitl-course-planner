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

const RETRY = 'บันทึกอีกครั้ง';
const MESSAGE = 'บันทึกตารางไม่สำเร็จ การแก้ไขล่าสุดยังไม่ได้เก็บไว้ในเบราว์เซอร์นี้';

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
      expect(container).toHaveTextContent('');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
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

  it('offers a retry in a danger strip while the latest save failed', () => {
    const retry = vi.fn();
    setStatus('failed', retry);
    render(<SaveIndicator />);
    const strip = screen.getByRole('button', { name: RETRY }).parentElement;
    expect(strip).toHaveClass('bg-danger-soft', 'border-danger', 'flex-wrap');
    const message = screen.getByText(MESSAGE);
    const button = screen.getByRole('button', { name: RETRY });
    expect(button).toHaveAttribute('aria-describedby', message.id);
    expect(button).toHaveAccessibleDescription(MESSAGE);
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the strip out of the live region, which speaks each notice once', () => {
    setStatus('saved');
    render(<SaveIndicator />);
    const region = screen.getByRole('status');
    expect(region).toHaveClass('sr-only');
    expect(region).toBeEmptyDOMElement();

    act(() => {
      autosaveStore.getState().setStatus('failed');
      autosaveStore.getState().announceFailure();
    });
    expect(region).toHaveTextContent('บันทึกตารางไม่สำเร็จ');
    expect(region).not.toContainElement(
      screen.getByRole('button', { name: RETRY }),
    );
    const first = region.firstElementChild;

    // An autosave that fails again raises no notice, so the words stay as they are.
    act(() => {
      autosaveStore.getState().setStatus('saving');
      autosaveStore.getState().setStatus('failed');
    });
    expect(region.firstElementChild).toBe(first);

    // A retry that fails raises a fresh notice, which remounts the words to be heard.
    act(() => {
      autosaveStore.getState().announceFailure();
    });
    expect(region.firstElementChild).not.toBe(first);
    expect(region).toHaveTextContent('บันทึกตารางไม่สำเร็จ');

    act(() => {
      autosaveStore.getState().setStatus('saved');
      autosaveStore.getState().clearNotice();
    });
    expect(region).toBeEmptyDOMElement();
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
      screen.getByRole('button', { name: 'Save again' }),
    ).toHaveAccessibleDescription(
      'The plan could not be saved. The latest changes are not stored in this browser.',
    );
  });
});
