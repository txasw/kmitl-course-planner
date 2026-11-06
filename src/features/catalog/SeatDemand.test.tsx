import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { Seats } from '@/lib/domain/types';
import { computeSeatDemand } from '@/lib/catalog/seatDemand';
import { makeSection } from '../../../tests/support/domain-builders';
import { SeatDemand } from './SeatDemand';

afterEach(cleanup);

function demandFor(seats: Seats, isClosed = false) {
  return computeSeatDemand(makeSection({ seats, isClosed }));
}

const OPEN: Seats = { limit: 45, preCount: 10, queueLeft: 5, enrolled: 33 };
const UNCAPPED: Seats = { limit: null, preCount: 3, queueLeft: 0, enrolled: 9 };
const FULL: Seats = { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' };

describe('SeatDemand', () => {
  it.each([
    ['ว่าง 12 จาก 45', 'th', OPEN, false, 'text-success'],
    ['12 of 45 open', 'en', OPEN, false, 'text-success'],
    ['ไม่จำกัดที่นั่ง', 'th', UNCAPPED, false, 'text-success'],
    ['No seat limit', 'en', UNCAPPED, false, 'text-success'],
    ['เต็ม เพิ่มไม่ได้', 'th', FULL, false, 'text-danger'],
    ['Full, cannot be added', 'en', FULL, false, 'text-danger'],
    ['ปิด เพิ่มไม่ได้', 'th', OPEN, true, 'text-ink-soft'],
    ['Closed, cannot be added', 'en', OPEN, true, 'text-ink-soft'],
  ] as const)(
    'shows %s as visible text',
    (text, locale, seats, isClosed, tone) => {
      render(
        <SeatDemand
          demand={demandFor(seats, isClosed)}
          t={createTranslator(locale)}
        />,
      );
      const line = screen.getByText(text);
      // Visible text, never a visually hidden label or a tooltip.
      expect(line).not.toHaveClass('sr-only');
      expect(line.closest('[role="tooltip"]')).toBeNull();
      expect(line.parentElement).toHaveClass(tone);
    },
  );

  it('keeps the icon out of the accessible text', () => {
    const { container } = render(
      <SeatDemand demand={demandFor(OPEN)} t={createTranslator('th')} />,
    );
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).toBe('ว่าง 12 จาก 45');
  });
});

const OVERSUBSCRIBED: Seats = {
  limit: 45,
  preCount: 171,
  queueLeft: 83,
  enrolled: 'full',
};

describe('SeatDemand full variant', () => {
  it.each([
    ['th', ['รับ 45', 'ลง 33', 'ล่วงหน้า 10', 'คิว 5']],
    ['en', ['Capacity 45', 'Enrolled 33', 'Pre registered 10', 'Queue 5']],
  ] as const)(
    'labels the host counts in %s after the seat line',
    (locale, figures) => {
      const { container } = render(
        <SeatDemand
          demand={demandFor(OPEN)}
          t={createTranslator(locale)}
          variant="full"
        />,
      );
      const [line, counts, ...rest] = Array.from(
        container.querySelectorAll('p'),
      );
      expect(line?.textContent).toBe(
        locale === 'th' ? 'ว่าง 12 จาก 45' : '12 of 45 open',
      );
      expect(
        Array.from(counts?.children ?? []).map((span) => span.textContent),
      ).toEqual(figures);
      // No oversubscribed note and no warn tone while demand fits the capacity.
      expect(rest).toHaveLength(0);
      expect(container.querySelector('.text-warn')).toBeNull();
    },
  );

  it('states an oversubscribed section in the warn tone, with no estimate', () => {
    const { container } = render(
      <SeatDemand
        demand={demandFor(OVERSUBSCRIBED)}
        t={createTranslator('th')}
        variant="full"
      />,
    );
    // A full section reports no enrolled number, so ลง is left out.
    expect(screen.getByText('รับ').parentElement).toHaveTextContent('รับ 45');
    expect(screen.queryByText('ลง')).toBeNull();
    const pre = screen.getByText('ล่วงหน้า').parentElement;
    expect(pre).toHaveTextContent('ล่วงหน้า 171');
    expect(pre).toHaveClass('text-warn');
    expect(screen.getByText('คิว').parentElement).not.toHaveClass('text-warn');
    expect(
      screen.getByText('ลงทะเบียนล่วงหน้าเกินจำนวนรับ').parentElement,
    ).toHaveClass('text-warn');
    for (const icon of container.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('leaves the capacity out of an uncapped section', () => {
    render(
      <SeatDemand
        demand={demandFor(UNCAPPED)}
        t={createTranslator('en')}
        variant="full"
      />,
    );
    expect(screen.getByText('No seat limit')).toBeInTheDocument();
    expect(screen.queryByText('Capacity')).toBeNull();
    expect(screen.getByText('Enrolled').parentElement).toHaveTextContent(
      'Enrolled 9',
    );
  });
});
