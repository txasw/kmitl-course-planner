import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
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
import { DraggableSection } from '@/features/catalog/DraggableSection';
import { dragStore } from './dragStore';
import { PlannerDnd } from './PlannerDnd';

const section = makeSection({ teachTableId: 's1' });
const course = makeCourse({ sections: [section] });
const vibrate = vi.fn();
const at = { clientX: 40, clientY: 40 };

function renderDnd() {
  render(
    <PlannerDnd>
      <DraggableSection
        id="s1"
        course={course}
        section={section}
        label="ลาก s1"
        onActivate={() => undefined}
      >
        <div>row</div>
      </DraggableSection>
    </PlannerDnd>,
  );
}

function lift(): Element | null {
  return document.querySelector('.kcp-grab-lift');
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    dragStore.getState().clearActive();
  });
  Reflect.deleteProperty(navigator, 'vibrate');
  vibrate.mockReset();
  vi.useRealTimers();
});

describe('PlannerDnd', () => {
  it('starts a touch drag after the long press, lifts the grab card, and vibrates', () => {
    renderDnd();
    fireEvent.touchStart(screen.getByText('row'), {
      touches: [at],
      changedTouches: [at],
    });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(dragStore.getState().active).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dragStore.getState().active?.section.teachTableId).toBe('s1');
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(lift()?.querySelector('[data-drag-card]')).not.toBeNull();
  });

  it('keeps the grab card at the pointer and stays silent for a mouse drag', () => {
    renderDnd();
    fireEvent.mouseDown(screen.getByText('row'), { button: 0, ...at });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 40 });
    expect(dragStore.getState().active?.section.teachTableId).toBe('s1');
    expect(vibrate).not.toHaveBeenCalled();
    expect(document.querySelector('[data-drag-card]')).not.toBeNull();
    expect(lift()).toBeNull();
    fireEvent.mouseUp(document, { clientX: 80, clientY: 40 });
  });
});
