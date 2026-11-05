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
