import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import { createTranslator, type Locale } from '@/lib/i18n/t';
import type { Seats } from '@/lib/domain/types';
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

function seedEntry(
  seats: Seats = { limit: 40, preCount: 0, queueLeft: 40, enrolled: 0 },
) {
  const entry = makePlanEntry({
    snapshot: makeSnapshot({
      teachTableId: 'x',
      seats,
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
    // The seat line reads from the snapshot seats in the catalog row convention.
    expect(screen.getByText('ว่าง 40 จาก 40')).toBeInTheDocument();
    expect(screen.getByText('วิชาทดสอบ')).toHaveAttribute('lang', 'th');
    expect(screen.getByRole('tooltip')).toHaveClass(
      'w-72',
      'kcp-scroll',
      'overflow-y-auto',
    );
    anchor.remove();
  });

  it.each([
    [
      'th',
      { limit: 45, preCount: 0, queueLeft: 0, enrolled: 33 },
      'ว่าง 12 จาก 45',
    ],
    [
      'en',
      { limit: 45, preCount: 0, queueLeft: 0, enrolled: 33 },
      '12 of 45 open',
    ],
    [
      'th',
      { limit: null, preCount: 0, queueLeft: 0, enrolled: 120 },
      'ไม่จำกัดที่นั่ง',
    ],
    [
      'th',
      { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
      'เต็ม เพิ่มไม่ได้',
    ],
  ] as const satisfies readonly (readonly [Locale, Seats, string])[])(
    'shows the %s seat line %j as %s',
    (locale, seats, text) => {
      seedEntry(seats);
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);
      render(
        <BlockHoverCard
          teachTableId="x"
          anchor={anchor}
          locale={locale}
          t={createTranslator(locale)}
          examOverlaps={[]}
          onClose={() => undefined}
        />,
      );
      expect(screen.getByText(text)).toBeInTheDocument();
      // One seat convention: the enrolled over limit fraction is gone.
      expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
      anchor.remove();
    },
  );

  it('renders the compact detail list, leaving the long fields to the popover', () => {
    const entry = makePlanEntry({
      lastVerifiedAt: '2026-11-06T01:05:00.000Z',
      snapshot: makeSnapshot({
        teachTableId: 'x',
        kind: 'practice',
        exam: { note: 'Take home exam' },
        rulesTh: 'เฉพาะชั้นปี 1',
        remark: 'เปิดสอนร่วมกับคณะอื่น',
      }),
    });
    act(() => {
      seedActivePlan([entry]);
    });
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
    expect(screen.getByText('เวลาเรียน', { selector: 'dt' })).toBeVisible();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'DD' && node.textContent === 'ปฏิบัติ 3(3-0-6)',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('จัดสอบเอง')).toBeInTheDocument();
    for (const text of [
      'Take home exam',
      'เฉพาะชั้นปี 1',
      'เปิดสอนร่วมกับคณะอื่น',
      'ตรวจสอบล่าสุด',
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    anchor.remove();
  });

  it('stays open while the pointer travels from the block onto the card', () => {
    seedEntry();
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const onClose = vi.fn();
    render(
      <BlockHoverCard
        teachTableId="x"
        anchor={anchor}
        locale="th"
        t={t}
        examOverlaps={[]}
        onClose={onClose}
      />,
    );
    const card = screen.getByRole('tooltip');
    // The card takes the pointer, so its long fields can be read and selected.
    expect(card).not.toHaveClass('pointer-events-none');

    fireEvent.mouseLeave(anchor, { relatedTarget: card });
    fireEvent.mouseMove(card);
    expect(onClose).not.toHaveBeenCalled();

    // Leaving the card for somewhere that is neither it nor the block closes it.
    fireEvent.mouseLeave(card, { relatedTarget: document.body });
    fireEvent.mouseMove(document.body, { clientX: 900, clientY: 900 });
    expect(onClose).toHaveBeenCalled();
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
