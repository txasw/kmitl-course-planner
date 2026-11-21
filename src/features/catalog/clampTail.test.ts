import { describe, it, expect, afterEach, vi } from 'vitest';
import { clampTailOffset } from './clampTail';

const LINE = 20;

/**
 * Lay a text out as a browser would, ten characters to a line, by giving each one-character
 * range the box of its line, and the line height to the element. A forced break draws no box.
 */
function layOut(root: HTMLElement, perLine = 10): void {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
    const style = real(node);
    if (node !== root) return style;
    // Test only assertion: the function reads the line height alone off the style.
    return {
      lineHeight: `${String(LINE)}px`,
    } as unknown as CSSStyleDeclaration;
  });
  const text = root.textContent;
  const box = (index: number) => {
    if (text[index] === '\n') return new DOMRect(0, 0, 0, 0);
    // A Thai face sits its glyph box a few pixels off the line box, and that offset varies.
    const drift = index % 3;
    return new DOMRect(0, Math.floor(index / perLine) * LINE + drift, 8, 18);
  };
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: Range) {
      let index = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (
        let node = walker.nextNode();
        node !== null;
        node = walker.nextNode()
      ) {
        if (node === this.startContainer) return box(index + this.startOffset);
        index += node.textContent?.length ?? 0;
      }
      return new DOMRect(0, 0, 0, 0);
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

function element(...parts: string[]): HTMLElement {
  const root = document.createElement('li');
  for (const part of parts) {
    const span = document.createElement('span');
    span.textContent = part;
    root.append(span);
  }
  document.body.append(root);
  return root;
}

describe('clampTailOffset', () => {
  it('finds the first character of the first hidden line', () => {
    const root = element('ก'.repeat(35));
    layOut(root);
    expect(clampTailOffset(root, 2)).toBe(20);
  });

  it('reads across the text nodes the split leaves behind', () => {
    const root = element('ก'.repeat(20), 'ข'.repeat(15));
    layOut(root);
    expect(clampTailOffset(root, 2)).toBe(20);
  });

  it('reports nothing hidden when the text fits the shown lines', () => {
    const root = element('ก'.repeat(18));
    layOut(root);
    expect(clampTailOffset(root, 2)).toBeNull();
  });

  it('reads past a forced break that draws no box', () => {
    const root = element(`${'ก'.repeat(19)}\n${'ข'.repeat(15)}`);
    layOut(root);
    // The break at 19 draws no box, so its line is read from the character at 20 and the
    // search lands on the break itself. Painting from the break hides the same ink as
    // painting from 20, since the break draws nothing.
    expect(clampTailOffset(root, 2)).toBe(19);
  });

  it('reads nothing where the document has no layout', () => {
    const root = element('ก'.repeat(35));
    expect(clampTailOffset(root, 2)).toBeNull();
  });
});
