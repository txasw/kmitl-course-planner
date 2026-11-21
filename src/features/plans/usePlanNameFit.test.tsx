import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import {
  planNameClass,
  triggerPadding,
  usePlanNameFit,
} from './usePlanNameFit';

function Harness({ name }: { name: string }) {
  const room = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const step = usePlanNameFit(label, room, name);
  return (
    <div ref={room}>
      <span ref={label} data-step={step} className={planNameClass(step)}>
        {name}
      </span>
    </div>
  );
}

/**
 * Lay the name out as a browser would at each step: one line at the body size is as wide
 * as the name, and a wrapped step stacks as many lines as the room needs.
 */
function layOut({
  oneLine,
  room,
  linesAt,
}: {
  oneLine: number;
  room: number;
  linesAt: { xs: number; '2xs': number };
}) {
  const step = (node: HTMLElement) =>
    node.className.includes('text-2xs')
      ? '2xs'
      : node.className.includes('text-xs')
        ? 'xs'
        : 'sm';
  const lineHeight = { xs: 15, '2xs': 14, sm: 22 } as const;
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return step(this) === 'sm' ? oneLine : room;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(room);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      const at = step(this);
      return at === 'sm' ? lineHeight.sm : linesAt[at] * lineHeight[at];
    },
  );
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
    const style = real(node);
    if (!(node instanceof HTMLElement)) return style;
    // Test only assertion: the hook reads the line height alone off the style.
    return {
      lineHeight: `${String(lineHeight[step(node)])}px`,
    } as unknown as CSSStyleDeclaration;
  });
}

function shownStep(container: HTMLElement): string | null {
  return (
    container.querySelector('[data-step]')?.getAttribute('data-step') ?? null
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('usePlanNameFit', () => {
  it('keeps a name the room holds on one line at the body size', () => {
    layOut({ oneLine: 120, room: 300, linesAt: { xs: 1, '2xs': 1 } });
    const { container } = render(<Harness name="ตาราง 2/2569" />);
    expect(shownStep(container)).toBe('0');
    expect(container.querySelector('span')).toHaveClass('truncate', 'text-sm');
  });

  it('wraps a longer name onto two lines a step down rather than cutting it', () => {
    layOut({ oneLine: 260, room: 140, linesAt: { xs: 2, '2xs': 2 } });
    const { container } = render(<Harness name="Plan 2/2569 Balanced" />);
    expect(shownStep(container)).toBe('1');
    const name = container.querySelector('span');
    expect(name).toHaveClass('text-xs', 'break-words');
    expect(name).not.toHaveClass('truncate');
    expect(name).not.toHaveClass('line-clamp-2');
  });

  it('steps down again when two lines at the first step are not enough', () => {
    layOut({ oneLine: 400, room: 140, linesAt: { xs: 3, '2xs': 2 } });
    const { container } = render(<Harness name="a longer plan name" />);
    expect(shownStep(container)).toBe('2');
  });

  it('wraps a name past two lines at the smallest step onto every line, never clamped', () => {
    layOut({ oneLine: 900, room: 140, linesAt: { xs: 6, '2xs': 5 } });
    const { container } = render(<Harness name="a name far too long" />);
    expect(shownStep(container)).toBe('2');
    const name = container.querySelector('span');
    expect(name).toHaveClass('text-2xs', 'break-words');
    expect(name).not.toHaveClass('line-clamp-2');
    expect(name).not.toHaveClass('truncate');
  });
});

describe('planNameClass', () => {
  it('clamps or truncates at no wrapped step', () => {
    for (const step of [1, 2]) {
      expect(planNameClass(step)).not.toMatch(/line-clamp|truncate|ellipsis/);
    }
  });
});

describe('triggerPadding', () => {
  it('pads the trigger only where it grows past the header row', () => {
    expect(triggerPadding(0)).toBe('py-px');
    expect(triggerPadding(1)).toBe('py-0');
    expect(triggerPadding(2)).toBe('py-1');
  });
});
