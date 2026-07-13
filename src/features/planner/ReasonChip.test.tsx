import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { ActiveDrag } from './dragStore';
import { ReasonChip } from './ReasonChip';

afterEach(cleanup);

function activeWith(placement: ActiveDrag['placement']): ActiveDrag {
  const section = makeSection({ teachTableId: 'd', subjectId: 'S1' });
  return {
    course: makeCourse({ subjectId: 'S1', sections: [section] }),
    section,
    group: [section],
    placement,
  };
}

describe('ReasonChip', () => {
  it('names the first blocking subject and section for a time conflict', () => {
    render(
      <ReasonChip
        active={activeWith({
          ok: false,
          conflicts: [
            {
              kind: 'time',
              blocking: {
                teachTableId: 'p',
                subjectId: '90000001',
                section: '901',
              },
              day: 1,
              startMin: 540,
              endMin: 600,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/90000001/)).toBeInTheDocument();
    expect(screen.getByText(/901/)).toBeInTheDocument();
  });

  it('states the duplicate reason for a duplicate conflict', () => {
    render(
      <ReasonChip
        active={activeWith({
          ok: false,
          conflicts: [
            {
              kind: 'duplicate',
              blocking: { teachTableId: 'p', subjectId: 'S1', section: '900' },
              subjectId: 'S1',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('มีวิชานี้ในตารางแล้ว')).toBeInTheDocument();
  });

  it('reads on the surface with a danger accent, not a saturated fill', () => {
    const { container } = render(
      <ReasonChip
        active={activeWith({
          ok: false,
          conflicts: [
            {
              kind: 'time',
              blocking: {
                teachTableId: 'p',
                subjectId: '90000001',
                section: '901',
              },
              day: 1,
              startMin: 540,
              endMin: 600,
            },
          ],
        })}
      />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).not.toContain('bg-danger');
  });

  it('shows a count when more conflicts follow the first', () => {
    render(
      <ReasonChip
        active={activeWith({
          ok: false,
          conflicts: [
            {
              kind: 'time',
              blocking: {
                teachTableId: 'p',
                subjectId: '90000001',
                section: '901',
              },
              day: 1,
              startMin: 540,
              endMin: 600,
            },
            {
              kind: 'time',
              blocking: {
                teachTableId: 'q',
                subjectId: '90000002',
                section: '902',
              },
              day: 2,
              startMin: 600,
              endMin: 660,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
  });

  it('renders nothing for a valid placement', () => {
    const { container } = render(
      <ReasonChip active={activeWith({ ok: true })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
