import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useOutsidePress } from './useOutsidePress';

// The helper mounts in a closed shadow root in production, where a document listener
// sees every press inside KCP retargeted to the shadow host. Each case runs in an open
// and a closed root, and with no shadow root at all as the unit tests render.

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
        fireEvent.pointerDown(inside);
      });
      expect(onPress).not.toHaveBeenCalled();
    });

    it('calls back on a press elsewhere in KCP and on the page', () => {
      const { onPress, elsewhere, page } = mount(mode, false);
      act(() => {
        fireEvent.pointerDown(elsewhere);
      });
      expect(onPress).toHaveBeenCalledTimes(1);
      act(() => {
        fireEvent.pointerDown(page);
      });
      expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('counts the whole of KCP as inside when asked', () => {
      const { onPress, elsewhere, inside, page } = mount(mode, true);
      act(() => {
        fireEvent.pointerDown(elsewhere);
        fireEvent.pointerDown(inside);
      });
      expect(onPress).toHaveBeenCalledTimes(mode === 'none' ? 1 : 0);
      act(() => {
        fireEvent.pointerDown(page);
      });
      expect(onPress).toHaveBeenCalledTimes(mode === 'none' ? 2 : 1);
    });
  },
);
