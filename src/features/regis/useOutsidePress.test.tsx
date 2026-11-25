import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useOutsidePress } from './useOutsidePress';

// The helper mounts in a closed shadow root in production, where a document listener
// sees every press inside KCP retargeted to the shadow host. Each case runs in an open
// and a closed root, and with no shadow root at all as the unit tests render. A press
// counts once it comes up where it went down, so the start of a scroll or a pinch on the
// page never counts.

/** A tap: down and up at one point with one pointer. */
function tap(target: Element, at = { clientX: 5, clientY: 5 }) {
  fireEvent.pointerDown(target, { pointerId: 1, isPrimary: true, ...at });
  fireEvent.pointerUp(target, { pointerId: 1, isPrimary: true, ...at });
}

function Part({
  onPress,
  wholeHost,
}: {
  onPress: () => void;
  wholeHost: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useOutsidePress(ref, true, onPress, wholeHost);
  return (
    <>
      <div ref={ref}>
        <button type="button">inside</button>
      </div>
      <button type="button">elsewhere in KCP</button>
    </>
  );
}

function mount(mode: ShadowRootMode | 'none', wholeHost: boolean) {
  const onPress = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const page = document.createElement('button');
  page.textContent = 'page';
  document.body.append(page);
  const container = document.createElement('div');
  (mode === 'none' ? host : host.attachShadow({ mode })).append(container);
  render(<Part onPress={onPress} wholeHost={wholeHost} />, { container });
  const byText = (text: string): HTMLElement => {
    const found = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === text,
    );
    if (found === undefined) throw new Error(`no ${text} button`);
    return found;
  };
  return {
    onPress,
    page,
    inside: byText('inside'),
    elsewhere: byText('elsewhere in KCP'),
  };
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe.each(['none', 'open', 'closed'] as const)(
  'useOutsidePress in a %s root',
  (mode) => {
    it('ignores a press inside the part', () => {
      const { onPress, inside } = mount(mode, false);
      act(() => {
        tap(inside);
      });
      expect(onPress).not.toHaveBeenCalled();
    });

    it('calls back on a press elsewhere in KCP and on the page', () => {
      const { onPress, elsewhere, page } = mount(mode, false);
      act(() => {
        tap(elsewhere);
      });
      expect(onPress).toHaveBeenCalledTimes(1);
      act(() => {
        tap(page);
      });
      expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('counts the whole of KCP as inside when asked', () => {
      const { onPress, elsewhere, inside, page } = mount(mode, true);
      act(() => {
        tap(elsewhere);
        tap(inside);
      });
      expect(onPress).toHaveBeenCalledTimes(mode === 'none' ? 1 : 0);
      act(() => {
        tap(page);
      });
      expect(onPress).toHaveBeenCalledTimes(mode === 'none' ? 2 : 1);
    });

    it('waits for the pointer to come up before it calls back', () => {
      const { onPress, page } = mount(mode, false);
      act(() => {
        fireEvent.pointerDown(page, { pointerId: 1, isPrimary: true });
      });
      expect(onPress).not.toHaveBeenCalled();
      act(() => {
        fireEvent.pointerUp(page, { pointerId: 1, isPrimary: true });
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('ignores a press that moves, scrolls, is cancelled, or is a pinch', () => {
      const { onPress, page } = mount(mode, false);
      const at = { pointerId: 1, isPrimary: true, clientX: 50, clientY: 50 };
      act(() => {
        // A drag of 12 px is the start of a scroll, not a tap.
        fireEvent.pointerDown(page, at);
        fireEvent.pointerMove(page, { ...at, clientY: 62 });
        fireEvent.pointerUp(page, { ...at, clientY: 62 });
        // A scroll between down and up, as the page scrolls under a still finger.
        fireEvent.pointerDown(page, at);
        fireEvent.scroll(document);
        fireEvent.pointerUp(page, at);
        // The browser takes the gesture over to scroll or zoom.
        fireEvent.pointerDown(page, at);
        fireEvent.pointerCancel(page, at);
        fireEvent.pointerUp(page, at);
        // A second finger makes it a pinch.
        fireEvent.pointerDown(page, at);
        fireEvent.pointerDown(page, { ...at, pointerId: 2, isPrimary: false });
        fireEvent.pointerUp(page, { ...at, pointerId: 2, isPrimary: false });
        fireEvent.pointerUp(page, at);
      });
      expect(onPress).not.toHaveBeenCalled();
      act(() => {
        // A small wobble under the slop still counts as a tap.
        fireEvent.pointerDown(page, at);
        fireEvent.pointerMove(page, { ...at, clientX: 55 });
        fireEvent.pointerUp(page, { ...at, clientX: 55 });
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  },
);
