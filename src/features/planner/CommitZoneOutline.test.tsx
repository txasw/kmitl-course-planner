import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import type { Section } from '@/lib/domain/types';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { dragStore } from './dragStore';
import { CommitZoneOutline } from './CommitZoneOutline';
import { PlannerDropZone } from './PlannerDropZone';

function startDrag(placed: Section[] = []): void {
  const section = makeSection({
    teachTableId: 'a',
    subjectId: 'S1',
    meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
  });
  act(() => {
    dragStore
      .getState()
      .start(
        makeCourse({ subjectId: 'S1', sections: [section] }),
        section,
        placed,
      );
  });
}

function outline(): Element | null {
  return document.querySelector('[data-commit-zone]');
}

afterEach(() => {
  cleanup();
  dragStore.getState().clearActive();
});

describe('CommitZoneOutline', () => {
  it('draws nothing while no drag is live', () => {
    render(<CommitZoneOutline over={false} />);
    expect(outline()).toBeNull();
  });

  it('draws a dashed latent outline from the start of a valid section drag', () => {
    startDrag();
    render(<CommitZoneOutline over={false} />);
    const node = outline();
    expect(node).toHaveAttribute('data-commit-zone', 'latent');
    expect(node).toHaveClass('border-2', 'border-dashed', 'border-success');
    expect(node).toHaveAttribute('aria-hidden', 'true');
    expect(node).toHaveTextContent('');
  });

  it('turns solid with a ring while the pointer is over the zone', () => {
    startDrag();
    render(<CommitZoneOutline over />);
    const node = outline();
    expect(node).toHaveAttribute('data-commit-zone', 'over');
    expect(node).toHaveClass('border-solid', 'ring-2');
    expect(node).not.toHaveClass('border-dashed');
  });

  it('drops its transition under reduced motion', () => {
    startDrag();
    render(<CommitZoneOutline over />);
    expect(outline()).toHaveClass(
      'transition-shadow',
      'motion-reduce:transition-none',
    );
  });

  it('stays hidden during a blocked section drag, which has no commit zone', () => {
    startDrag([
      makeSection({
        teachTableId: 'p',
        subjectId: 'OTHER',
        meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
      }),
    ]);
    render(<CommitZoneOutline over />);
    expect(outline()).toBeNull();
  });

  it('is drawn inside the planner drop zone, whose box it outlines', () => {
    startDrag();
    render(
      <DndContext>
        <PlannerDropZone>
          <p>grid</p>
        </PlannerDropZone>
      </DndContext>,
    );
    const node = outline();
    expect(node).toHaveAttribute('data-commit-zone', 'latent');
    expect(node?.parentElement).toHaveClass('relative');
  });

  it('clears when the drag ends', () => {
    startDrag();
    render(<CommitZoneOutline over={false} />);
    act(() => {
      dragStore.getState().clearActive();
    });
    expect(outline()).toBeNull();
  });
});
