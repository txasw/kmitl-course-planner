import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { expectNoSeriousA11yViolations } from '../../tests/support/axe';
import { Tooltip } from './Tooltip';

afterEach(cleanup);

function renderTooltip() {
  return render(
    <Tooltip label="Full name">
      {(triggerProps, ref) => (
        <button type="button" ref={ref} {...triggerProps}>
          Trigger
        </button>
      )}
    </Tooltip>,
  );
}

describe('Tooltip', () => {
  it('shows on focus and hides on blur', async () => {
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Full name');
    // floating-ui defers the blur check to the next frame to see whether focus
    // moved into the tooltip, so the close is asynchronous.
    fireEvent.blur(trigger);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  it('shows on hover after the open delay', async () => {
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.mouseEnter(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Full name');
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('describes the trigger while shown', () => {
    renderTooltip();
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.focus(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('dismisses on Escape without the event reaching an ancestor', () => {
    const onAncestorEscape = vi.fn();
    // Model the overlay focus trap, which listens on an ancestor in the bubble
    // phase, so the assertion proves the tooltip stops Escape before it gets there.
    const { container } = renderTooltip();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onAncestorEscape();
      }
    };
    container.addEventListener('keydown', handler);
    try {
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      fireEvent.focus(trigger);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fireEvent.keyDown(trigger, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(onAncestorEscape).not.toHaveBeenCalled();
    } finally {
      container.removeEventListener('keydown', handler);
    }
  });

  it('keeps the trigger own click handler', () => {
    const onClick = vi.fn();
    render(
      <Tooltip label="Full name">
        {(triggerProps, ref) => (
          <button type="button" ref={ref} {...triggerProps} onClick={onClick}>
            Trigger
          </button>
        )}
      </Tooltip>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to the top placement', () => {
    renderTooltip();
    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('tooltip')).toHaveAttribute(
      'data-placement',
      'top',
    );
  });

  it('honors a requested placement so it can point away from a popover body', () => {
    // A control inside a downward popover points its tooltip below itself so the
    // tooltip never covers the options above it (the plan menu action buttons).
    render(
      <Tooltip label="Full name" placement="bottom">
        {(triggerProps, ref) => (
          <button type="button" ref={ref} {...triggerProps}>
            Trigger
          </button>
        )}
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('tooltip')).toHaveAttribute(
      'data-placement',
      'bottom',
    );
  });

  it('has no accessibility violations while shown', async () => {
    renderTooltip();
    fireEvent.focus(screen.getByRole('button', { name: 'Trigger' }));
    await expectNoSeriousA11yViolations(document.body);
  });
});
