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
  rulesTh: '',
  rulesEn: '',
  remark: '',
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Make every fit column report a 20 px overflow while it contains `text`, standing in for
 * the layout jsdom does not perform. */
function overflowWhileShowing(text: string): void {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.textContent.includes(text) ? 100 : 80;
    },
  );
}

describe('EventBlock', () => {
  it('lets a swipe on a draggable block scroll and leaves a long press to the drag', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        dragListeners={{}}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(block).toHaveClass('touch-drag', 'cursor-grab');
    expect(block).not.toHaveClass('touch-none');
  });

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

  it('pins the name as the anchor and demotes the time to the yielding foot', () => {
    // A positioned block encodes the time by position, so the name is the primary anchor
    // pinned at the top while the time reads as quiet metadata in the foot, which yields
    // first on a short block (ADR-0047).
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
    // The name is pinned so it never disappears while a lower priority field remains.
    expect(within(block).getByText('วิชาทดสอบ').className).toContain(
      'shrink-0',
    );
    // The time now sits in the foot beside the id and can be squeezed away; it is not pinned.
    const foot = within(block).getByText('09:00-12:00').closest('.mt-1');
    expect(foot).not.toBeNull();
    expect(foot?.className).not.toContain('shrink-0');
    expect(foot?.className).toContain('min-h-0');
    expect(foot?.textContent).toContain('90592033');
  });

  it('keeps the foot under the place in edit and at the box bottom on the poster', () => {
    // A tall edit block reads as one cluster with its spare height below; the poster fit
    // keeps the time and id at the foot of its measured box (ADR-0046, ADR-0047).
    const { rerender } = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const footOf = () =>
      within(screen.getByLabelText(/90592033/)).getByText('09:00-12:00')
        .parentElement;
    expect(footOf()?.className).toContain('mt-1');
    expect(footOf()?.className).not.toContain('mt-auto');
    rerender(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        footAtBottom
      />,
    );
    expect(footOf()?.className).toContain('mt-auto');
  });

  it('wraps and hyphenates a long name by its language rather than clipping a glyph', () => {
    // A long token in a narrow column wraps and, where a forced break is needed, hyphenates
    // by the text language so it never clips mid glyph; the language attribute also keeps Thai
    // on its native dictionary breaking (F2, ADR-0046, ADR-0047).
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
    const nameEl = within(block).getByText('วิชาทดสอบ');
    expect(nameEl.className).toContain('break-words');
    expect(nameEl.className).toContain('hyphens-auto');
    expect(nameEl).toHaveAttribute('lang', 'th');
  });

  it('gives block text Thai headroom only on the export poster', () => {
    // The edit grid keeps the tight line height even while it fits its box; the export poster
    // raises it so stacked Thai vowels and tone marks are never cropped (F3, ADR-0046).
    const { rerender } = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByLabelText(/90592033/).className).toContain(
      'leading-tight',
    );
    rerender(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        thaiHeadroom
      />,
    );
    expect(screen.getByLabelText(/90592033/).className).toContain(
      'leading-[1.5]',
    );
  });

  it('floats the section as a corner chip while the place is promoted above the foot', () => {
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
    // The foot holds the quiet time and id; the promoted place line sits above it, not in it.
    const foot = within(block).getByText('90592033').closest('.mt-1');
    expect(foot).not.toBeNull();
    expect(foot?.textContent).not.toContain('901');
    expect(foot?.textContent).not.toContain('A · A101');
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

  it('draws no verification marks when showVerification is off, as on the poster', () => {
    const { container } = render(
      <EventBlock
        section={{ ...section, verifyStatus: 'missing' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        conflicted
        examConflicted
        showVerification={false}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(block).not.toHaveAttribute('data-verify');
    expect(block.className).not.toContain('ring-danger');
    expect(container.querySelector('.kcp-hatch')).toBeNull();
    expect(container.querySelector('.bg-danger, .bg-warn')).toBeNull();
    // The accessible name follows what is drawn, so it carries no badge text either.
    expect(block.getAttribute('aria-label')).not.toMatch(
      /ไม่พบในระบบแล้ว|เวลาชนกัน|เวลาสอบชนกัน/,
    );
  });

  it('draws no warn dot for a changed section when showVerification is off', () => {
    const { container } = render(
      <EventBlock
        section={{ ...section, verifyStatus: 'changed' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showVerification={false}
      />,
    );
    expect(screen.getByLabelText(/90592033/)).not.toHaveAttribute(
      'data-verify',
    );
    expect(container.querySelector('.bg-warn')).toBeNull();
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

  it('hides the subject id when showSubjectId is off', () => {
    // The preview toggle governs the visible id; the id stays in the accessible label as
    // the block identity, so the block is still found by it.
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        showSubjectId={false}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).queryByText('90592033')).not.toBeInTheDocument();
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

  it('drops the subject id first when a short edit block overflows', () => {
    // jsdom performs no layout, so the content column reports an overflow for as long as it
    // still holds the subject id, the height a short block cannot fit.
    overflowWhileShowing('90592033');
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onOpenDetail={vi.fn()}
      />,
    );
    const block = screen.getByRole('button', { name: /90592033/ });
    expect(within(block).queryByText('90592033')).not.toBeInTheDocument();
    // Only the id yielded: the time, the place, the section, and the name all remain.
    expect(within(block).getByText('09:00-12:00')).toBeInTheDocument();
    expect(within(block).getByText('A · A101')).toBeInTheDocument();
    expect(within(block).getByText('901')).toBeInTheDocument();
    expect(within(block).getByText('วิชาทดสอบ')).toBeInTheDocument();
  });

  it('holds its field set while the fit is paused for a drag', () => {
    overflowWhileShowing('90592033');
    const props = {
      section,
      meeting,
      style: {},
      locale: 'th' as const,
      t,
    };
    const { rerender } = render(<EventBlock {...props} fitPaused />);
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('90592033')).toBeInTheDocument();
    // The drag ends: the fit runs again and drops the id that overflows.
    rerender(<EventBlock {...props} fitPaused={false} />);
    expect(within(block).queryByText('90592033')).not.toBeInTheDocument();
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
