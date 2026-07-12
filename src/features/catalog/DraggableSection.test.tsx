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
import { dragStore } from '@/features/planner/dragStore';
import { DraggableSection } from './DraggableSection';

const course = makeCourse();
const section = makeSection({ teachTableId: 's1' });

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
});
