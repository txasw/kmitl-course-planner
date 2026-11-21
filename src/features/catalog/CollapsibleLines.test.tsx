import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { CollapsibleLines } from './CollapsibleLines';

// The start of a remark captured from the registrar, whose third line in a section row
// carries the doubled tone mark of "ต่อเนื่่อง" that rose beside the ellipsis.
const REMARK =
  'วัดคุม 1, แมคคาทรอนิกส์ 1, ออโตเมชั่น 1, คอมพิวเตอร์ 1, คอมพิวเตอร์และไอโอที(ต่อเนื่่อง) 1';
// jsdom has no layout, so the clamp tail is stubbed where that third line starts.
const TAIL = REMARK.indexOf('คอมพิวเตอร์และ');
vi.mock('./clampTail', () => ({
  clampTailOffset: vi.fn(() => TAIL),
}));

// jsdom has no layout, so the shared line observer never reports. This stub records the
// report callback so a test can fire it after giving the line a clipped height. It is
// installed before the first render, which creates the shared observer.
let report: ((target: Element) => void) | null = null;
class RecordingObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    report = (target) => {
      callback(
        [
          {
            target,
            contentRect: new DOMRectReadOnly(),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    };
  }
  observe(): void {
    return undefined;
  }
  unobserve(): void {
    return undefined;
  }
  disconnect(): void {
    return undefined;
  }
}
globalThis.ResizeObserver = RecordingObserver;

function renderLines() {
  return render(
    <CollapsibleLines
      icon={null}
      label="หมายเหตุ"
      lines={[REMARK]}
      toneClass="text-ink-soft"
      expandLabel="ดูหมายเหตุทั้งหมด"
      collapseLabel="ย่อหมายเหตุ"
    />,
  );
}

function reportClipped(container: HTMLElement): HTMLElement {
  const line = container.querySelector('li');
  if (line === null) throw new Error('no collapsed line');
  Object.defineProperty(line, 'scrollHeight', { value: 80 });
  Object.defineProperty(line, 'clientHeight', { value: 32 });
  act(() => {
    report?.(line);
  });
  return line;
}

afterEach(cleanup);

describe('CollapsibleLines', () => {
  it('paints no ink of the lines the clamp hides', () => {
    const { container } = renderLines();
    const line = reportClipped(container);
    const tail = line.querySelector('[data-clamp-tail]');
    // The hidden lines keep their place, so the clamp and its ellipsis are unchanged, but
    // paint transparent, so a tone mark rising from them never shows beside the ellipsis.
    expect(tail).toHaveClass('text-transparent');
    expect(tail?.textContent).toBe(REMARK.slice(TAIL));
    expect(line).toHaveClass('line-clamp-2');
    // The whole remark stays in the accessible text.
    expect(line.textContent).toBe(REMARK);
  });

  it('shows every line in full ink once expanded', () => {
    const { container } = renderLines();
    reportClipped(container);
    fireEvent.click(screen.getByRole('button', { name: 'ดูหมายเหตุทั้งหมด' }));
    expect(container.querySelector('[data-clamp-tail]')).toBeNull();
    expect(screen.getByText(REMARK)).toBeInTheDocument();
  });

  it('leaves a line that fits whole in one piece', () => {
    const { container } = renderLines();
    expect(container.querySelector('[data-clamp-tail]')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
