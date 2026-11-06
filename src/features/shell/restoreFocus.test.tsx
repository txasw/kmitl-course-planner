import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import {
  canTakeFocus,
  commitThenFocus,
  focusFirst,
  useReturnFocus,
} from './restoreFocus';

afterEach(cleanup);

function button(label: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.textContent = label;
  return node;
}

describe('canTakeFocus', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('accepts a connected, laid out, live control', () => {
    const node = button('live');
    document.body.append(node);
    expect(canTakeFocus(node)).toBe(true);
  });

  it('rejects a control that left the document', () => {
    expect(canTakeFocus(button('detached'))).toBe(false);
  });

  it('rejects a control in an inert pane', () => {
    const pane = document.createElement('div');
    pane.setAttribute('inert', '');
    const node = button('inert');
    pane.append(node);
    document.body.append(pane);
    expect(canTakeFocus(node)).toBe(false);
  });

  it('rejects a control with no layout box', () => {
    const pane = document.createElement('div');
    pane.hidden = true;
    const node = button('hidden');
    pane.append(node);
    document.body.append(pane);
    expect(canTakeFocus(node)).toBe(false);
  });
});

describe('focusFirst', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('focuses the first candidate that can take focus', () => {
    const pane = document.createElement('div');
    pane.setAttribute('inert', '');
    const skipped = button('skipped');
    pane.append(skipped);
    const target = button('target');
    document.body.append(pane, target);
    expect(focusFirst([null, undefined, skipped, target])).toBe(target);
    expect(target).toHaveFocus();
  });

  it('returns null and leaves focus when no candidate can take it', () => {
    const current = button('current');
    document.body.append(current);
    current.focus();
    expect(focusFirst([button('detached'), null])).toBeNull();
    expect(current).toHaveFocus();
  });

  it('passes the focus options on', () => {
    const target = button('target');
    document.body.append(target);
    const spy = vi.spyOn(target, 'focus');
    focusFirst([target], { preventScroll: true });
    expect(spy).toHaveBeenCalledWith({ preventScroll: true });
  });
});

// A list whose rows each carry their own remove control, the shape of a remove that
// unmounts the very control that holds focus.
function RemovableList({ initial }: { initial: string[] }) {
  const [rows, setRows] = useState(initial);
  const remove = (row: string) => {
    commitThenFocus(
      () => {
        setRows((current) => current.filter((item) => item !== row));
        return rows.indexOf(row);
      },
      (index) => {
        const left = document.querySelectorAll<HTMLElement>('[data-row]');
        return [left[index], left[left.length - 1], screen.getByRole('list')];
      },
    );
  };
  return (
    <ul tabIndex={-1}>
      {rows.map((row) => (
        <li key={row}>
          <button
            type="button"
            data-row={row}
            onClick={() => {
              remove(row);
            }}
          >
            {row}
          </button>
        </li>
      ))}
    </ul>
  );
}

describe('commitThenFocus', () => {
  it('focuses a target the commit rendered, chosen from its result', () => {
    render(<RemovableList initial={['a', 'b', 'c']} />);
    const b = screen.getByRole('button', { name: 'b' });
    b.focus();
    act(() => {
      b.click();
    });
    expect(screen.getByRole('button', { name: 'c' })).toHaveFocus();
  });

  it('falls back to the next target when the first is gone', () => {
    render(<RemovableList initial={['a', 'b']} />);
    const b = screen.getByRole('button', { name: 'b' });
    b.focus();
    act(() => {
      b.click();
    });
    expect(screen.getByRole('button', { name: 'a' })).toHaveFocus();
  });

  it('lands on the container when no row is left', () => {
    render(<RemovableList initial={['a']} />);
    const a = screen.getByRole('button', { name: 'a' });
    a.focus();
    act(() => {
      a.click();
    });
    expect(screen.getByRole('list')).toHaveFocus();
  });

  it('returns the commit result', () => {
    expect(
      commitThenFocus(
        () => 7,
        () => [],
      ),
    ).toBe(7);
  });
});

// A surface opened from an anchor, which closes from its own button.
function AnchoredSurface({ removeAnchor = false }: { removeAnchor?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [anchorShown, setAnchorShown] = useState(true);
  return (
    <div>
      {anchorShown ? (
        <button
          type="button"
          onClick={(event) => {
            setAnchor(event.currentTarget);
          }}
        >
          anchor
        </button>
      ) : null}
      <button type="button">elsewhere</button>
      <div role="dialog" aria-modal="true" tabIndex={-1} data-testid="modal" />
      {anchor !== null ? (
        <Surface
          anchor={anchor}
          onClose={() => {
            if (removeAnchor) setAnchorShown(false);
            setAnchor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Surface({
  anchor,
  onClose,
}: {
  anchor: HTMLElement;
  onClose: () => void;
}) {
  useReturnFocus(anchor);
  return (
    <button type="button" onClick={onClose}>
      close
    </button>
  );
}

function openSurface(): HTMLElement {
  const anchor = screen.getByRole('button', { name: 'anchor' });
  act(() => {
    anchor.click();
  });
  return anchor;
}

describe('useReturnFocus', () => {
  it('returns focus to the anchor when focus left with the surface', () => {
    render(<AnchoredSurface />);
    const anchor = openSurface();
    const close = screen.getByRole('button', { name: 'close' });
    close.focus();
    act(() => {
      close.click();
    });
    expect(anchor).toHaveFocus();
  });

  it('returns focus parked on a modal root to the anchor', () => {
    render(<AnchoredSurface />);
    const anchor = openSurface();
    screen.getByTestId('modal').focus();
    act(() => {
      screen.getByRole('button', { name: 'close' }).click();
    });
    expect(anchor).toHaveFocus();
  });

  it('keeps focus that moved to another control', () => {
    render(<AnchoredSurface />);
    openSurface();
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' });
    elsewhere.focus();
    act(() => {
      screen.getByRole('button', { name: 'close' }).click();
    });
    expect(elsewhere).toHaveFocus();
  });

  it('skips an anchor that left the document', () => {
    render(<AnchoredSurface removeAnchor />);
    openSurface();
    const close = screen.getByRole('button', { name: 'close' });
    close.focus();
    act(() => {
      close.click();
    });
    expect(document.body).toHaveFocus();
  });
});
