import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  within,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { createTranslator, type Translate } from '@/lib/i18n/t';
import type { Meeting } from '@/lib/domain/types';
import { EventBlock } from './EventBlock';
import type { PlacedSection } from './placedSection';

const t = createTranslator('th');

const section: PlacedSection = {
  teachTableId: 't1',
  subjectId: '90592033',
  section: '901',
  nameTh: 'วิชาทดสอบ',
  nameEn: 'Test subject',
  credit: 3,
  kind: 'lecture',
  meetings: [],
  verifyStatus: 'unverified',
};

const meeting: Meeting = {
  day: 1,
  startMin: 540,
  endMin: 720,
  room: 'A101',
  building: 'A',
  kind: 'lecture',
};

afterEach(cleanup);

describe('EventBlock', () => {
  it('shows the time, name, subject id, section, and place', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('09:00-12:00')).toBeInTheDocument();
    expect(within(block).getByText('วิชาทดสอบ')).toBeInTheDocument();
    expect(within(block).getByText('90592033')).toBeInTheDocument();
    expect(within(block).getByText('901')).toBeInTheDocument();
    // Building and room read together as the place.
    expect(within(block).getByText('A · A101')).toBeInTheDocument();
  });

  it('pins the time and name so the foot yields first on a short block', () => {
    // The name must never disappear while a lower priority field remains. The time and
    // the name are shrink-0 so a short block clips the foot (id, chip, place) first
    // rather than squeezing the name to nothing, which inverts the emphasis order.
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('09:00-12:00').className).toContain(
      'shrink-0',
    );
    expect(within(block).getByText('วิชาทดสอบ').className).toContain(
      'shrink-0',
    );
    // The foot carries the subject id and can be squeezed away; it is not pinned.
    const foot = within(block).getByText('90592033').closest('.mt-auto');
    expect(foot).not.toBeNull();
    expect(foot?.className).not.toContain('shrink-0');
    expect(foot?.className).toContain('min-h-0');
  });

  it('floats the section as a corner chip over quiet id and place metadata', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    // The section reads as a floating chip in the corner, absolutely positioned.
    expect(within(block).getByText('901').className).toContain('absolute');
    // The foot holds the id as quiet metadata, no longer the section chip.
    const foot = within(block).getByText('90592033').closest('.mt-auto');
    expect(foot).not.toBeNull();
    expect(foot?.textContent).not.toContain('901');
  });

  it('names the room in the accessible label when the room shows', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByLabelText(/A101/)).toBeInTheDocument();
  });

  it('omits the room from the accessible label when showRoom is off', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showRoom={false}
      />,
    );
    expect(screen.queryByLabelText(/A101/)).not.toBeInTheDocument();
  });

  it('badges a missing section as danger', () => {
    render(
      <EventBlock
        section={{ ...section, verifyStatus: 'missing' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByLabelText(/ไม่พบในระบบแล้ว/)).toHaveAttribute(
      'data-verify',
      'danger',
    );
  });

  it('badges a changed section as warn', () => {
    render(
      <EventBlock
        section={{ ...section, verifyStatus: 'changed' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByLabelText(/ข้อมูลเปลี่ยน/)).toHaveAttribute(
      'data-verify',
      'warn',
    );
  });

  it('badges a conflicted section as danger', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        conflicted
      />,
    );
    expect(screen.getByLabelText(/เวลาชนกัน/)).toHaveAttribute(
      'data-verify',
      'danger',
    );
  });

  it('fills with the subject stable color', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(block.style.backgroundColor).not.toBe('');
  });

  it('omits the room line when there is no room', () => {
    render(
      <EventBlock
        section={section}
        meeting={{ ...meeting, room: '' }}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('A101')).not.toBeInTheDocument();
  });

  it('shows the English name in the English locale', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('Test subject')).toBeInTheDocument();
  });

  it('hides the section code when showSection is off', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showSection={false}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).queryByText('901')).not.toBeInTheDocument();
  });

  it('hides the room when showRoom is off', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showRoom={false}
      />,
    );
    expect(screen.queryByText('A101')).not.toBeInTheDocument();
  });

  it('adds the English name under a Thai primary when showEnglishName is on', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showEnglishName
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('วิชาทดสอบ')).toBeInTheDocument();
    expect(within(block).getByText('Test subject')).toBeInTheDocument();
  });

  it('does not duplicate the English name when it is already the primary', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
        showEnglishName
      />,
    );
    expect(screen.getAllByText('Test subject')).toHaveLength(1);
  });

  it('renders a remove control that fires onRemove in edit mode', () => {
    const onRemove = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onRemove={onRemove}
        removeLabel={t('action.remove')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('action.remove') }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    // The block passes its own id so the grid can hand down one stable handler.
    expect(onRemove).toHaveBeenCalledWith('t1');
  });

  it('renders no remove control without onRemove', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the detail popover from the block on click and keyboard in edit mode', () => {
    const onOpenDetail = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onOpenDetail={onOpenDetail}
      />,
    );
    // The block itself is the button; the hover card replaced the info affordance, so no
    // separate details control remains on the block chrome.
    expect(
      screen.queryByRole('button', { name: t('block.details') }),
    ).not.toBeInTheDocument();
    const block = screen.getByRole('button');
    expect(block).toHaveAttribute('data-teach-table-id', 't1');

    // A click anchors the popover to the block.
    fireEvent.click(block);
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    const anchor = onOpenDetail.mock.calls[0]?.[0] as HTMLElement;
    expect(anchor.dataset.teachTableId).toBe('t1');

    // Enter and Space on the focused block are the keyboard path to details and actions.
    fireEvent.keyDown(block, { key: 'Enter' });
    expect(onOpenDetail).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(block, { key: ' ' });
    expect(onOpenDetail).toHaveBeenCalledTimes(3);
  });

  it('keeps the remove control a sibling of the block button, never nested', () => {
    const onOpenDetail = vi.fn();
    const onRemove = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onOpenDetail={onOpenDetail}
        onRemove={onRemove}
        removeLabel={t('action.remove')}
      />,
    );
    const block = screen.getByRole('button', { name: /90592033/ });
    const remove = screen.getByRole('button', { name: t('action.remove') });
    // No interactive control nests inside another, so a click on remove never bubbles to
    // the block and axe stays clear of nested-interactive.
    expect(block.contains(remove)).toBe(false);
  });

  it('skips re-rendering when its props are unchanged and re-renders on a change', () => {
    // The block renders through t, so counting t calls counts its renders. The grid
    // relies on this memo so a drag hover re-renders only the blocks whose flags move.
    let renders = 0;
    const countingT: Translate = (key) => {
      renders += 1;
      return t(key);
    };
    const style = {};
    const props = {
      section,
      meeting,
      style,
      locale: 'th' as const,
      t: countingT,
    };

    const { rerender } = render(<EventBlock {...props} />);
    const afterFirst = renders;
    expect(afterFirst).toBeGreaterThan(0);

    // Identical prop references: the memo skips, so no further t calls.
    rerender(<EventBlock {...props} />);
    expect(renders).toBe(afterFirst);

    // A flag flip, as a drag start produces on a blocking block: it re-renders.
    rerender(<EventBlock {...props} pulsing />);
    expect(renders).toBeGreaterThan(afterFirst);
  });
});
