import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StatusReveal } from './StatusReveal';

const LABEL = 'หน่วยกิตรวมเกินเกณฑ์ปกติ';

afterEach(() => {
  cleanup();
});

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: LABEL });
}

describe('StatusReveal', () => {
  it('reveals its words on a press and closes on Escape back to the trigger', () => {
    render(<StatusReveal label={LABEL}>24</StatusReveal>);
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(LABEL)).toBeInTheDocument();

    fireEvent.keyDown(trigger(), { key: 'Escape' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveFocus();
  });

  it('claims the Escape press so no outer layer closes with it', () => {
    let outerSaw = false;
    function handleOuterKeyDown(): void {
      outerSaw = true;
    }
    const { container } = render(<StatusReveal label={LABEL}>24</StatusReveal>);
    container.addEventListener('keydown', handleOuterKeyDown);
    fireEvent.click(trigger());
    const press = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    trigger().dispatchEvent(press);
    expect(outerSaw).toBe(false);
    expect(press.defaultPrevented).toBe(true);
    container.removeEventListener('keydown', handleOuterKeyDown);
  });

  it('leaves a press a deeper layer already handled to that layer', () => {
    render(<StatusReveal label={LABEL}>24</StatusReveal>);
    fireEvent.click(trigger());
    const press = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    press.preventDefault();
    trigger().dispatchEvent(press);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });
});
