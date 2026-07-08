import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { dragStore } from './dragStore';
import { WeeklyGrid } from './WeeklyGrid';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

function makePlaced(overrides: Partial<PlacedSection> = {}): PlacedSection {
  return {
    teachTableId: 't1',
    subjectId: '90592033',
    section: '901',
    nameTh: 'วิชาทดสอบ',
    nameEn: 'Test subject',
    credit: 3,
    kind: 'lecture',
    meetings: [
      {
        day: 1,
        startMin: 540,
        endMin: 720,
        room: 'A101',
        building: 'A',
        kind: 'lecture',
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  dragStore.getState().clearActive();
  dragStore.getState().clearBlocked();
});

describe('WeeklyGrid', () => {
  it('places a 09:00 to 12:00 Monday meeting at grid column 10 / 22 in row 3', () => {
    render(
      <WeeklyGrid
        sections={[makePlaced()]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(block.style.gridColumn).toBe('10 / 22');
    expect(block.style.gridRow).toBe('3');
  });

  it('labels the grid and the seven day rows', () => {
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    expect(
      screen.getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('วันจันทร์')).toBeInTheDocument();
    expect(screen.getByLabelText('วันเสาร์')).toBeInTheDocument();
  });

  it('shows an hour label at the window start and its last hour', () => {
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('renders a valid footprint ghost during a fitting drag', () => {
    const dragged = makeSection({
      teachTableId: 'd',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore
      .getState()
      .start(makeCourse({ subjectId: 'S1', sections: [dragged] }), dragged, []);
    render(
      <WeeklyGrid sections={[]} window={DEFAULT_WINDOW} locale="th" t={t} />,
    );
    expect(document.querySelector('[data-ghost="valid"]')).not.toBeNull();
    expect(document.querySelector('[data-ghost="blocked"]')).toBeNull();
  });

  it('renders a blocked ghost and pulses the blocking block', () => {
    const placedView = makePlaced({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
    });
    const placedDomain = makeSection({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const dragged = makeSection({
      teachTableId: 'd',
      subjectId: 'S1',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    dragStore
      .getState()
      .start(makeCourse({ subjectId: 'S1', sections: [dragged] }), dragged, [
        placedDomain,
      ]);
    render(
      <WeeklyGrid
        sections={[placedView]}
        window={DEFAULT_WINDOW}
        locale="th"
        t={t}
      />,
    );
    expect(document.querySelector('[data-ghost="blocked"]')).not.toBeNull();
    expect(screen.getByLabelText(/OTHER/).className).toContain('kcp-pulse');
  });
});
