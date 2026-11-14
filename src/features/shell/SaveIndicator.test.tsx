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
  SAVE_INDICATOR_ID,
  type AutosaveStatus,
} from '@/features/plans/autosaveStore';
import { makePlan } from '../../../tests/support/domain-builders';
import { resetPlanStore } from '../../../tests/support/plan-store';
import { planStore } from '@/features/plans/planStore';
import { SaveIndicator } from './SaveIndicator';
import { uiStore } from './uiStore';

function setStatus(status: AutosaveStatus, retry: () => void = vi.fn()) {
  act(() => {
    if (planStore.getState().plans.length === 0) {
      planStore.getState().hydrate([makePlan({ id: 'a' })]);
    }
    autosaveStore.getState().attach(retry);
    autosaveStore.getState().setStatus(status);
  });
}

afterEach(() => {
  cleanup();
  resetPlanStore();
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

  it('stays out of the way beside an empty plan list', () => {
    setStatus('saved');
    act(() => {
      resetPlanStore();
    });
    const { container } = render(<SaveIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('still reports a failed save of an empty plan list', () => {
    setStatus('failed');
    act(() => {
      resetPlanStore();
    });
    render(<SaveIndicator />);
    expect(
      screen.getByRole('button', { name: 'ยังไม่ได้บันทึก บันทึกอีกครั้ง' }),
    ).toBeInTheDocument();
  });

  it('reads saved with where the plan is kept', () => {
    setStatus('saved');
    render(<SaveIndicator />);
    const indicator = document.getElementById(SAVE_INDICATOR_ID);
    expect(indicator).toHaveTextContent('บันทึกแล้ว');
    expect(indicator).toHaveAttribute('title', 'บันทึกไว้ในเบราว์เซอร์นี้แล้ว');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reads saving while a save is pending', () => {
    setStatus('saving');
    render(<SaveIndicator />);
    const indicator = document.getElementById(SAVE_INDICATOR_ID);
    expect(indicator).toHaveTextContent('กำลังบันทึก');
    expect(indicator).not.toHaveAttribute('title');
  });

  it('follows the state as it changes', () => {
    setStatus('saving');
    render(<SaveIndicator />);
    act(() => {
      autosaveStore.getState().setStatus('saved');
    });
    expect(document.getElementById(SAVE_INDICATOR_ID)).toHaveTextContent(
      'บันทึกแล้ว',
    );
  });

  it('keeps the word for a screen reader and shows the mark alone below 640 px', () => {
    setStatus('saved');
    render(<SaveIndicator />);
    expect(screen.getByText('บันทึกแล้ว')).toHaveClass(
      'sr-only',
      'sm:not-sr-only',
    );
  });

  it('is no live region in any state', () => {
    for (const status of ['saving', 'saved', 'failed'] as const) {
      setStatus(status);
      const { container, unmount } = render(<SaveIndicator />);
      expect(
        container.querySelector('[aria-live], [role="status"], [role="alert"]'),
      ).toBeNull();
      unmount();
    }
  });

  it('offers a retry while the latest save failed', () => {
    const retry = vi.fn();
    setStatus('failed', retry);
    render(<SaveIndicator />);
    const button = screen.getByRole('button', {
      name: 'ยังไม่ได้บันทึก บันทึกอีกครั้ง',
    });
    expect(button).toHaveAttribute('id', SAVE_INDICATOR_ID);
    expect(button).toHaveTextContent('ยังไม่ได้บันทึก');
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the indicator when pressing retry turns it quiet', () => {
    const retry = vi.fn(() => {
      autosaveStore.getState().setStatus('saving');
    });
    setStatus('failed', retry);
    render(<SaveIndicator />);
    const button = screen.getByRole('button', {
      name: 'ยังไม่ได้บันทึก บันทึกอีกครั้ง',
    });
    act(() => {
      button.focus();
    });
    fireEvent.click(button);
    const indicator = document.getElementById(SAVE_INDICATOR_ID);
    expect(indicator).not.toBe(button);
    expect(indicator).toHaveTextContent('กำลังบันทึก');
    expect(indicator).toHaveFocus();
  });

  it('keeps focus on the indicator when a save it waits on fails', () => {
    setStatus('saving');
    render(<SaveIndicator />);
    act(() => {
      document.getElementById(SAVE_INDICATOR_ID)?.focus();
    });
    act(() => {
      autosaveStore.getState().setStatus('failed');
    });
    expect(
      screen.getByRole('button', { name: 'ยังไม่ได้บันทึก บันทึกอีกครั้ง' }),
    ).toHaveFocus();
  });

  it('leaves focus alone when the indicator did not hold it', () => {
    setStatus('saving');
    render(
      <>
        <button type="button">elsewhere</button>
        <SaveIndicator />
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' });
    act(() => {
      elsewhere.focus();
    });
    act(() => {
      autosaveStore.getState().setStatus('failed');
    });
    expect(elsewhere).toHaveFocus();
  });

  it('takes focus in a quiet state, where a retry from the toast lands', () => {
    setStatus('saving');
    render(<SaveIndicator />);
    const indicator = document.getElementById(SAVE_INDICATOR_ID);
    act(() => {
      indicator?.focus();
    });
    expect(indicator).toHaveFocus();
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
