import { describe, it, expect, vi } from 'vitest';
import { claimEscape } from './escape';

// The spy is returned beside the event so the assertions read it directly rather than
// through an unbound method of the event object.
function fakeEvent(key: string, defaultPrevented = false) {
  const preventDefault = vi.fn();
  return { event: { key, defaultPrevented, preventDefault }, preventDefault };
}

describe('claimEscape', () => {
  it('claims an unclaimed Escape and marks it handled', () => {
    const { event, preventDefault } = fakeEvent('Escape');
    expect(claimEscape(event)).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('leaves an Escape an inner surface already claimed', () => {
    const { event, preventDefault } = fakeEvent('Escape', true);
    expect(claimEscape(event)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it.each(['Enter', 'Tab', 'Esc', 'ArrowDown', ' '])(
    'ignores the %j key',
    (key) => {
      const { event, preventDefault } = fakeEvent(key);
      expect(claimEscape(event)).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
    },
  );

  it('lets only the innermost of two nested claims win on a real event', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });
    expect(claimEscape(event)).toBe(true);
    expect(claimEscape(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });
});
