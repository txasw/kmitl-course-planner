import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import {
  makeMeeting,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import { BlockHoverCard } from './BlockHoverCard';

const t = createTranslator('th');

afterEach(() => {
  cleanup();
  act(() => {
    resetPlanStore();
  });
});

function seedEntry() {
  const entry = makePlanEntry({
    snapshot: makeSnapshot({
      teachTableId: 'x',
      subjectId: '90592033',
      section: '901',
      meetings: [
        makeMeeting({
          day: 1,
          startMin: 540,
          endMin: 660,
          room: 'A101',
          building: 'A',
        }),
      ],
      teachersTh: ['อ. ทดสอบ'],
      subjectMeta: {
        subjectId: '90592033',
        nameTh: 'วิชาทดสอบ',
        nameEn: 'Test subject',
        credit: 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
  act(() => {
    seedActivePlan([entry]);
  });
}

describe('BlockHoverCard', () => {
  it('shows the detail set for the hovered block', () => {
    seedEntry();
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    render(
      <BlockHoverCard
        teachTableId="x"
        anchor={anchor}
        locale="th"
        t={t}
        examOverlaps={[]}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByText(/90592033/)).toBeInTheDocument();
    expect(screen.getByText(/A101/)).toBeInTheDocument();
    expect(screen.getByText(/อ\. ทดสอบ/)).toBeInTheDocument();
    // The seat line reads from the snapshot seats.
    expect(screen.getByText(/ที่นั่ง/)).toBeInTheDocument();
    anchor.remove();
  });

  it('renders nothing when the entry has left the plan', () => {
    const { container } = render(
      <BlockHoverCard
        teachTableId="gone"
        anchor={document.createElement('div')}
        locale="th"
        t={t}
        examOverlaps={[]}
        onClose={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
