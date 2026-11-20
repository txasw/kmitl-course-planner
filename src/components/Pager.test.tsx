import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PagerArrow, PagerDots, usePager } from './Pager';

const LABELS = ['หน้า 1', 'หน้า 2', 'หน้า 3'];

function Harness() {
  const [selected, setSelected] = useState(0);
  const { move, groupRef, handleKeyDown } = usePager({
    count: LABELS.length,
    selected,
    onSelect: setSelected,
  });
  return (
    <>
      <PagerArrow
        label="ถัดไป"
        disabled={selected === LABELS.length - 1}
        onActivate={() => {
          move(1);
        }}
      >
        next
      </PagerArrow>
      <PagerDots
        groupRef={groupRef}
        onKeyDown={handleKeyDown}
        label="หน้า"
        itemLabels={LABELS}
        selected={selected}
        onSelect={setSelected}
      />
    </>
  );
}

function checked(): string | null {
  return (
    screen
      .getAllByRole('radio')
      .find((radio) => radio.getAttribute('aria-checked') === 'true')
      ?.getAttribute('aria-label') ?? null
  );
}

afterEach(cleanup);

describe('Pager', () => {
  it('pages from the arrow and lands focus on the selected dot', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    expect(checked()).toBe('หน้า 2');
    expect(screen.getByRole('radio', { name: 'หน้า 2' })).toHaveFocus();
  });

  it('jumps with Home and End and clamps at the ends', () => {
    render(<Harness />);
    const first = screen.getByRole('radio', { name: 'หน้า 1' });
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(checked()).toBe('หน้า 1');
    fireEvent.keyDown(first, { key: 'End' });
    expect(checked()).toBe('หน้า 3');
    expect(screen.getByRole('button', { name: 'ถัดไป' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'หน้า 3' }), {
      key: 'Home',
    });
    expect(checked()).toBe('หน้า 1');
  });

  it('opens no tooltip on a dot, which would cover the caption above', () => {
    render(<Harness />);
    const dot = screen.getByRole('radio', { name: 'หน้า 1' });
    fireEvent.focus(dot);
    fireEvent.mouseEnter(dot);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(dot).not.toHaveAttribute('aria-describedby');
  });

  it('names an arrow in a tooltip on focus', () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole('button', { name: 'ถัดไป' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('ถัดไป');
  });

  it('opens no tooltip on an arrow that asks for none', () => {
    render(
      <PagerArrow
        label="ก่อนหน้า"
        disabled={false}
        onActivate={() => undefined}
        tooltip={false}
      >
        previous
      </PagerArrow>,
    );
    const arrow = screen.getByRole('button', { name: 'ก่อนหน้า' });
    fireEvent.focus(arrow);
    fireEvent.mouseEnter(arrow);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(arrow).not.toHaveAttribute('aria-describedby');
  });

  it('names the group and keeps one dot in the tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'หน้า' })).toBeInTheDocument();
    const tabbable = screen
      .getAllByRole('radio')
      .filter((radio) => radio.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });
});
