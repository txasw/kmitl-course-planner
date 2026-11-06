import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { DndContext } from '@dnd-kit/core';
import { dragStore } from '@/features/planner/dragStore';
import { usePlannerSensors } from '@/features/planner/usePlannerSensors';
import { DraggableSection } from './DraggableSection';

const course = makeCourse();
const section = makeSection({ teachTableId: 's1' });

function Harness() {
  const sensors = usePlannerSensors();
  return (
    <DndContext sensors={sensors}>
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={() => undefined}
      >
        <div>row</div>
      </DraggableSection>
    </DndContext>
  );
}

function surface(): HTMLElement {
  const node = document.querySelector<HTMLElement>(
    '[data-drag-surface="section"]',
  );
  if (node === null) throw new Error('expected a section drag surface');
  return node;
}

afterEach(() => {
  cleanup();
  act(() => {
    dragStore.getState().clearHover();
  });
});

describe('DraggableSection', () => {
  it('commits from the grip on activation', () => {
    const onActivate = vi.fn();
    render(
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={onActivate}
      >
        <div>row</div>
      </DraggableSection>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ลาก s1' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('exposes the whole row as the section drag surface', () => {
    render(
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={() => undefined}
      >
        <div>row</div>
      </DraggableSection>,
    );
    expect(
      document.querySelector('[data-drag-surface="section"]'),
    ).not.toBeNull();
  });

  it('previews the section on grip focus and clears it on blur', () => {
    render(
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={() => undefined}
      >
        <div>row</div>
      </DraggableSection>,
    );
    const grip = screen.getByRole('button', { name: 'ลาก s1' });
    fireEvent.focus(grip);
    expect(dragStore.getState().hover?.teachTableId).toBe('s1');
    fireEvent.blur(grip);
    expect(dragStore.getState().hover).toBeNull();
  });

  it('previews the section for a mouse over the row but not for a touch', () => {
    render(<Harness />);
    fireEvent.pointerEnter(surface(), { pointerType: 'touch' });
    expect(dragStore.getState().hover).toBeNull();
    fireEvent.pointerEnter(surface(), { pointerType: 'mouse' });
    expect(dragStore.getState().hover?.teachTableId).toBe('s1');
    fireEvent.pointerLeave(surface(), { pointerType: 'mouse' });
    expect(dragStore.getState().hover).toBeNull();
  });

  it('lets a swipe on the row scroll and leaves a long press to the drag', () => {
    render(<Harness />);
    expect(surface()).toHaveClass('touch-drag');
    expect(surface()).not.toHaveClass('touch-none');
  });

  it('drags from the row but never from a press on the grip', () => {
    render(<Harness />);
    const grip = screen.getByRole('button', { name: 'ลาก s1' });
    fireEvent.mouseDown(grip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { clientX: 60, clientY: 10 });
    expect(surface()).not.toHaveClass('opacity-40');
    fireEvent.mouseUp(document, { clientX: 60, clientY: 10 });

    fireEvent.mouseDown(screen.getByText('row'), {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseMove(document, { clientX: 60, clientY: 10 });
    expect(surface()).toHaveClass('opacity-40');
    fireEvent.mouseUp(document, { clientX: 60, clientY: 10 });
  });

  it('arms a touch drag after a long press on the row, never on the grip', () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      const at = { clientX: 10, clientY: 10 };
      const hold = (target: HTMLElement) => {
        fireEvent.touchStart(target, { touches: [at], changedTouches: [at] });
        act(() => {
          vi.advanceTimersByTime(300);
        });
      };
      const grip = screen.getByRole('button', { name: 'ลาก s1' });
      hold(grip);
      expect(surface()).not.toHaveClass('opacity-40');
      fireEvent.touchEnd(grip, { touches: [], changedTouches: [at] });

      const row = screen.getByText('row');
      hold(row);
      expect(surface()).toHaveClass('opacity-40');
      fireEvent.touchEnd(row, { touches: [], changedTouches: [at] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the row pressed while a finger holds it, then dims it once it drags', () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      const row = screen.getByText('row');
      const at = { clientX: 10, clientY: 10 };
      fireEvent.pointerDown(row, {
        pointerType: 'touch',
        isPrimary: true,
        ...at,
      });
      fireEvent.touchStart(row, { touches: [at], changedTouches: [at] });
      act(() => {
        vi.advanceTimersByTime(120);
      });
      expect(surface()).toHaveClass('outline-border-strong', 'bg-surface-alt');
      act(() => {
        vi.advanceTimersByTime(130);
      });
      expect(surface()).toHaveClass('opacity-40');
      expect(surface()).not.toHaveClass('outline-border-strong');
      fireEvent.touchEnd(row, { touches: [], changedTouches: [at] });
      fireEvent.pointerUp(row, { pointerType: 'touch', ...at });
      expect(surface()).not.toHaveClass('opacity-40');
      expect(surface()).not.toHaveClass('outline-border-strong');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears its own row hover when it unmounts under the pointer', () => {
    const { unmount } = render(
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={() => undefined}
      >
        <div>row</div>
      </DraggableSection>,
    );
    const surface = document.querySelector('[data-drag-surface="section"]');
    if (surface === null) throw new Error('expected the drag surface');
    fireEvent.pointerEnter(surface, { pointerType: 'mouse' });
    expect(dragStore.getState().hover?.teachTableId).toBe('s1');
    unmount();
    expect(dragStore.getState().hover).toBeNull();
  });

  it('leaves a row hover another section has taken since', () => {
    const { unmount } = render(
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={() => undefined}
      >
        <div>row</div>
      </DraggableSection>,
    );
    const other = makeSection({ teachTableId: 's2' });
    act(() => {
      dragStore.getState().setHover(other);
    });
    unmount();
    expect(dragStore.getState().hover).toBe(other);
  });
});
