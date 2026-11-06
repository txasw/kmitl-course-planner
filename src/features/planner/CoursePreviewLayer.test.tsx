import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { DndContext, useDndContext } from '@dnd-kit/core';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { searchStore } from '@/features/search/searchStore';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { dragStore } from './dragStore';
import { CoursePreviewLayer } from './CoursePreviewLayer';
import { CandidateLayer } from './CandidateLayer';
import { CandidateSlot } from './CandidateSlot';

afterEach(() => {
  cleanup();
  act(() => {
    resetPlanStore();
    dragStore.setState({
      hoverCourse: null,
      active: null,
      courseDrag: null,
      blockMove: null,
    });
  });
});

const fit = makeSection({
  teachTableId: 'fit',
  subjectId: 'S1',
  section: '901',
  meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 660 })],
});
const clash = makeSection({
  teachTableId: 'clash',
  subjectId: 'S1',
  section: '902',
  meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
});
const full = makeSection({
  teachTableId: 'full',
  subjectId: 'S1',
  section: '903',
  meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 660 })],
  seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
});
const course = makeCourse({ subjectId: 'S1', sections: [fit, clash, full] });

function placeOn(day: 1 | 2): void {
  seedActivePlan([
    makePlanEntry({
      snapshot: makeSnapshot({
        teachTableId: `placed-${String(day)}`,
        subjectId: `OTHER${String(day)}`,
        section: '900',
        meetings: [makeMeeting({ day, startMin: 540, endMin: 660 })],
      }),
    }),
  ]);
}

function Layer() {
  return (
    <div>
      <CoursePreviewLayer
        window={DEFAULT_WINDOW}
        days={WEEK_DAYS}
        orientation="landscape"
      />
    </div>
  );
}

function preview(kind: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-preview="${kind}"]`);
  if (node === null) throw new Error(`expected a ${kind} preview`);
  return node;
}

describe('CoursePreviewLayer', () => {
  it('draws nothing without a hovered course', () => {
    render(<Layer />);
    expect(document.querySelector('[data-preview]')).toBeNull();
  });

  it('styles a fit, a clash and a full section, labelling only the fit', () => {
    act(() => {
      placeOn(1);
      dragStore.getState().setHoverCourse(course);
    });
    render(<Layer />);
    for (const kind of ['fit', 'clash', 'unavailable']) {
      expect(preview(kind).className).toContain('border-dotted');
      expect(preview(kind).className).toContain('border-2');
      expect(preview(kind).className).toContain('pointer-events-none');
      expect(preview(kind)).toHaveAttribute('aria-hidden', 'true');
    }
    expect(preview('fit').className).toContain('border-success');
    expect(preview('fit')).toHaveTextContent('กลุ่มเรียน 901');
    expect(preview('clash').className).toContain('border-danger');
    expect(preview('clash').querySelector('.kcp-hatch')).not.toBeNull();
    expect(preview('clash')).toHaveTextContent('');
    expect(preview('unavailable').className).toContain('border-ink-soft');
    expect(preview('unavailable').querySelector('.kcp-hatch')).toBeNull();
    expect(preview('unavailable')).toHaveTextContent('');
  });

  it('reclassifies a fit into a clash when the plan changes', () => {
    act(() => {
      placeOn(1);
      dragStore.getState().setHoverCourse(course);
    });
    render(<Layer />);
    expect(document.querySelectorAll('[data-preview="fit"]')).toHaveLength(1);
    act(() => {
      seedActivePlan([
        makePlanEntry({
          snapshot: makeSnapshot({
            teachTableId: 'placed-both',
            subjectId: 'OTHER',
            section: '900',
            meetings: [
              makeMeeting({ day: 1, startMin: 540, endMin: 660 }),
              makeMeeting({ day: 2, startMin: 540, endMin: 660 }),
            ],
          }),
        }),
      ]);
    });
    expect(document.querySelector('[data-preview="fit"]')).toBeNull();
    expect(document.querySelectorAll('[data-preview="clash"]')).toHaveLength(2);
  });

  it('draws nothing while a course drag is in flight', () => {
    act(() => {
      dragStore.getState().setHoverCourse(course);
    });
    render(<Layer />);
    expect(document.querySelector('[data-preview]')).not.toBeNull();
    act(() => {
      dragStore.setState({ courseDrag: { course, candidates: [] } });
    });
    expect(document.querySelector('[data-preview]')).toBeNull();
  });

  it('registers no droppable', () => {
    function Probe() {
      const { size } = useDndContext().droppableContainers;
      return <output data-testid="droppables">{size}</output>;
    }
    act(() => {
      dragStore.getState().setHoverCourse(course);
    });
    // One real candidate slot beside the layer proves the probe counts droppables, so
    // the single registration it reports is the slot's alone.
    render(
      <DndContext>
        <Layer />
        <CandidateSlot
          id="control"
          candidate={{
            section: fit,
            group: [fit],
            valid: true,
            reason: 'ok',
            conflicts: [],
          }}
          style={{}}
          raised={false}
        />
        <Probe />
      </DndContext>,
    );
    expect(document.querySelectorAll('[data-preview]')).toHaveLength(3);
    expect(screen.getByTestId('droppables')).toHaveTextContent('1');
  });

  it('takes precedence over a row hover ghost, which is dotted', () => {
    act(() => {
      dragStore.getState().setHover(fit);
    });
    render(
      <div>
        <CandidateLayer
          sections={[]}
          window={DEFAULT_WINDOW}
          days={WEEK_DAYS}
          orientation="landscape"
        />
      </div>,
    );
    const ghost = document.querySelector('[data-ghost="hover"]');
    expect(ghost?.className).toContain('border-dotted');
    act(() => {
      dragStore.getState().setHoverCourse(course);
    });
    expect(document.querySelector('[data-ghost="hover"]')).toBeNull();
    expect(document.querySelector('[data-preview]')).not.toBeNull();
    act(() => {
      dragStore.getState().clearHover();
    });
  });

  it('clears the preview when a new search result lands', () => {
    act(() => {
      dragStore.getState().setHoverCourse(course);
    });
    render(<Layer />);
    act(() => {
      searchStore.setState({ result: { status: 'loading' } });
    });
    expect(dragStore.getState().hoverCourse).toBeNull();
    expect(document.querySelector('[data-preview]')).toBeNull();
    act(() => {
      searchStore.setState({ result: { status: 'idle' } });
    });
  });
});
