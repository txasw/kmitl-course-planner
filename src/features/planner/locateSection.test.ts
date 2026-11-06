import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { LOCATE_MS, locateSection } from './locateSection';

// jsdom has no layout, so it does not implement scrollIntoView; record the calls instead.
const scrollIntoView = vi.fn();

beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.replaceChildren();
  scrollIntoView.mockReset();
  vi.useRealTimers();
});

function block(id: string, order: number): HTMLElement {
  const element = document.createElement('div');
  element.dataset.teachTableId = id;
  element.dataset.blockOrder = String(order);
  element.tabIndex = 0;
  return element;
}

function mount(...children: HTMLElement[]): HTMLElement {
  const root = document.createElement('div');
  root.append(...children);
  document.body.append(root);
  return root;
}

describe('locateSection', () => {
  it('focuses and pulses the earliest block of the section, then clears the pulse', () => {
    const early = block('a', 300);
    const root = mount(block('a', 900), early, block('b', 100));
    const target = locateSection(root, 'a', false);
    expect(target).toBe(early);
    expect(early).toHaveFocus();
    expect(early).toHaveClass('kcp-locate');
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    );
    vi.advanceTimersByTime(LOCATE_MS);
    expect(early).not.toHaveClass('kcp-locate');
  });

  it('marks the shelf row of a section with no block and leaves focus alone', () => {
    const list = document.createElement('ul');
    const row = document.createElement('li');
    const remove = document.createElement('button');
    remove.dataset.shelfRemove = 'a';
    row.append(remove);
    list.append(row);
    const root = mount(list);
    const target = locateSection(root, 'a', true);
    expect(target).toBe(row);
    expect(row).toHaveClass('kcp-locate');
    expect(remove).not.toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    );
  });

  it('returns null when the section shows nowhere', () => {
    expect(locateSection(mount(block('b', 100)), 'a', false)).toBeNull();
  });
});
