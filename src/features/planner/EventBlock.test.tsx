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
import { hashColor } from '@/lib/utils/hash-color';
import { EventBlock } from './EventBlock';
import { HATCH_BAND } from './blockSurface';
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
function overflowWhileShowing(...texts: string[]): void {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return texts.some((text) => this.textContent.includes(text)) ? 100 : 80;
    },
  );
}

describe('EventBlock', () => {
  it('reports a hover for a mouse pointer only', () => {
    const onHoverEnter = vi.fn();
    const onHoverLeave = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onHoverEnter={onHoverEnter}
        onHoverLeave={onHoverLeave}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    fireEvent.pointerEnter(block, { pointerType: 'touch' });
    fireEvent.pointerEnter(block, { pointerType: 'pen' });
    expect(onHoverEnter).not.toHaveBeenCalled();
    fireEvent.pointerEnter(block, { pointerType: 'mouse' });
    expect(onHoverEnter).toHaveBeenCalledWith(block);
    fireEvent.pointerLeave(block, { pointerType: 'mouse' });
    expect(onHoverLeave).toHaveBeenCalledTimes(1);
  });

  it('opens the context menu for a mouse but swallows one from a long press', () => {
    const onContextMenu = vi.fn();
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onContextMenu={onContextMenu}
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    const touch = new PointerEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    });
    // fireEvent reports false once a handler prevented the default browser menu.
    expect(fireEvent(block, touch)).toBe(false);
    expect(onContextMenu).not.toHaveBeenCalled();

    fireEvent.contextMenu(block);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    const mouse = new PointerEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      pointerType: 'mouse',
    });
    fireEvent(block, mouse);
    expect(onContextMenu).toHaveBeenCalledTimes(2);
  });

  it('shows the pressed outline in place of the cleared outline while pressed', () => {
    const props = {
      section,
      meeting,
      style: {},
      locale: 'th' as const,
      t,
      dragListeners: {},
    };
    const { rerender } = render(<EventBlock {...props} />);
    const block = screen.getByLabelText(/90592033/);
    expect(block).toHaveClass('outline-none');
    expect(block).not.toHaveClass('outline-border-strong');
    rerender(<EventBlock {...props} pressed />);
    expect(block).toHaveClass('outline-border-strong');
    expect(block).not.toHaveClass('outline-none');
  });

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
    expect(within(block).getByText('วิชาทดสอบ').className).toContain('shrink-0');
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

  it('wraps a Thai name only between its dictionary words', () => {
    // The language attribute keeps Thai on its native dictionary breaking, and no forced break
    // splits a word, so a word wider than its column overflows and the fit steps the name form
    // down instead of stranding a letter on its own line (ADR-0046, ADR-0047).
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
    expect(nameEl).toHaveClass('break-normal');
    expect(nameEl).not.toHaveClass('break-words');
    expect(nameEl).toHaveAttribute('lang', 'th');
  });

  it('wraps an English name only at its spaces, so no word breaks inside', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    const nameEl = screen.getByText('Test subject');
    expect(nameEl.className).toContain('break-normal');
    expect(nameEl.className).not.toContain('break-words');
    expect(nameEl).toHaveAttribute('lang', 'en');
  });

  it('keeps the words whole of a Thai name field written in Latin letters', () => {
    render(
      <EventBlock
        section={{ ...section, nameTh: 'ARTIFICIAL INTELLIGENCE' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const nameEl = screen.getByText('ARTIFICIAL INTELLIGENCE');
    expect(nameEl.className).toContain('break-normal');
    expect(nameEl.className).not.toContain('break-words');
    expect(nameEl).toHaveAttribute('lang', 'th');
  });

  it('steps an English name a type step down while a word is wider than its line', () => {
    // A word is wider than the name line at the full size and fits one step smaller.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-fit-name') &&
          !this.className.includes('text-[0.9em]')
          ? 52
          : 40;
      },
    );
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    const nameEl = screen.getByText('Test subject');
    expect(nameEl.className).toContain('text-[0.9em]');
  });

  it('abbreviates an English name too wide by a word at either size, never showing the id', () => {
    const long = { ...section, nameEn: 'INTRODUCTION TO PROGRAMMING' };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-fit-name') &&
          /INTRODUCTION|PROGRAMMING/.test(this.textContent)
          ? 52
          : 40;
      },
    );
    render(
      <EventBlock
        section={long}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
        showSubjectId
      />,
    );
    const block = screen.getByLabelText(/INTRODUCTION TO PROGRAMMING/);
    const nameEl = block.querySelector<HTMLElement>('[data-fit-name]');
    // The least shortened form that fits: both long words cut, the joiner whole.
    expect(nameEl?.textContent).toBe('INTRODUCT. TO PROGRAMM.');
    expect(nameEl).toHaveAttribute('data-name-form', 'abbreviated');
    expect(nameEl?.className).toContain('text-[0.9em]');
    // The id keeps its own place in the foot and never stands in for the name.
    const ids = screen.getAllByText('90592033');
    expect(ids).toHaveLength(1);
    expect(ids[0]).toHaveAttribute('data-fit-whole', 'id');
  });

  it('breaks the shortest form inside a word only where no abbreviation fits', () => {
    const long = { ...section, nameEn: 'INTRODUCTION TO PROGRAMMING' };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-fit-name') &&
          this.dataset.nameForm !== 'break'
          ? 52
          : 40;
      },
    );
    render(
      <EventBlock
        section={long}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    const block = screen.getByLabelText(/INTRODUCTION TO PROGRAMMING/);
    const nameEl = block.querySelector<HTMLElement>('[data-fit-name]');
    expect(nameEl).toHaveAttribute('data-name-form', 'break');
    expect(nameEl?.textContent).toBe('IN. TO PR.');
    expect(nameEl?.className).toContain('wrap-anywhere');
  });

  it('breaks a Thai name too wide by a word inside it, with no abbreviation', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-fit-name') &&
          this.dataset.nameForm !== 'break'
          ? 52
          : 40;
      },
    );
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const nameEl = screen.getByText('วิชาทดสอบ');
    expect(nameEl).toHaveAttribute('data-name-form', 'break');
    expect(nameEl.className).toContain('wrap-anywhere');
    expect(nameEl.className).toContain('text-[0.9em]');
  });

  it('names an inert block for a screen reader by its full name', () => {
    const long = { ...section, nameEn: 'INTRODUCTION TO PROGRAMMING' };
    render(
      <EventBlock
        section={long}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(
      screen.getByRole('group', { name: /INTRODUCTION TO PROGRAMMING/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fits a name afresh when a locale switch swaps it for one of the same shape', () => {
    // Neither name has abbreviated forms, so only the name itself tells the fit to reset.
    const short = { ...section, nameEn: 'ART OF WAR' };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-fit-name') &&
          this.textContent.includes('วิชาทดสอบ') &&
          this.dataset.nameForm !== 'break'
          ? 52
          : 40;
      },
    );
    const { rerender } = render(
      <EventBlock
        section={short}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.getByText('วิชาทดสอบ')).toHaveAttribute(
      'data-name-form',
      'break',
    );
    rerender(
      <EventBlock
        section={short}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
      />,
    );
    expect(screen.getByText('ART OF WAR')).toHaveAttribute(
      'data-name-form',
      'full',
    );
  });

  it('keeps a Thai name on its dictionary breaks whatever its width', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(40);
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const nameEl = screen.getByText('วิชาทดสอบ');
    expect(nameEl.className).not.toContain('text-[0.9em]');
  });

  it('drops a second name whole when one of its words is wider than its line', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.fitWhole === 'secondary' ? 58 : 40;
      },
    );
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    expect(screen.queryByText('Test subject')).not.toBeInTheDocument();
    expect(screen.getByText('วิชาทดสอบ')).toBeInTheDocument();
    expect(screen.getByText('90592033')).toBeInTheDocument();
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

  it('sets the section chip in flow at the end of the place row, above the foot', () => {
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
    // The chip trails the place in the same wrapping row, so it never sits over text.
    const chip = within(block).getByText('901');
    expect(chip.className).not.toContain('absolute');
    // The row spreads the place and the chip apart; an auto margin would read back as fixed
    // pixels in the export capture and wrap the chip out of the image.
    expect(chip).not.toHaveClass('ml-auto');
    expect(chip.parentElement).toHaveClass('justify-between');
    expect(chip.parentElement?.textContent).toContain('A · A101');
    // The foot holds the quiet time and id; the promoted place line sits above it, not in it.
    const foot = within(block).getByText('90592033').closest('.mt-1');
    expect(foot).not.toBeNull();
    expect(foot?.textContent).not.toContain('901');
    expect(foot?.textContent).not.toContain('A · A101');
  });

  it('keeps the place slot under a quiet placeholder when there is no room', () => {
    render(
      <EventBlock
        section={section}
        meeting={{ ...meeting, room: '', building: '' }}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    // The chip stays at the end of the place row rather than moving into the place slot.
    const placeholder = screen.getByText('ไม่ระบุห้อง');
    expect(placeholder).toHaveClass('text-ink-soft');
    const row = screen.getByText('901').parentElement;
    expect(row).toHaveClass('justify-between');
    expect(row?.firstElementChild).toBe(placeholder);
    // The glyph takes the quiet text color rather than the subject color.
    expect(placeholder.querySelector('svg')?.getAttribute('style')).toBeNull();
    // The accessible name reads the placeholder too, as the block shows it.
    expect(screen.getByLabelText(/ไม่ระบุห้อง$/)).toBeInTheDocument();
  });

  it('keeps the day card place line under the placeholder in English', () => {
    const english = createTranslator('en');
    render(
      <EventBlock
        section={section}
        meeting={{ ...meeting, room: '', building: '' }}
        style={{}}
        locale="en"
        t={english}
        nameLanguage="both"
        dayCard
      />,
    );
    const card = document.querySelector<HTMLElement>('[data-day-card]');
    const lines = Array.from(card?.children ?? []).map(
      (line) => line.textContent,
    );
    expect(lines).toEqual([
      '09:00-12:00',
      'Test subject',
      'วิชาทดสอบ',
      'No room',
      'Section 901Lecture90592033',
    ]);
    expect(screen.getByText('No room')).toHaveClass('text-ink-soft');
  });

  it('leaves the place out of every block when the room display is off', () => {
    render(
      <EventBlock
        section={section}
        meeting={{ ...meeting, room: '', building: '' }}
        style={{}}
        locale="th"
        t={t}
        showRoom={false}
      />,
    );
    expect(screen.queryByText('ไม่ระบุห้อง')).not.toBeInTheDocument();
  });

  it('wraps every field rather than ellipsizing it', () => {
    const { container } = render(
      <EventBlock
        section={{ ...section, nameEn: 'A long English secondary name' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    expect(container.querySelector('.truncate, .line-clamp-1')).toBeNull();
    // At full density the name carries no clamp, so a name the box holds shows in full.
    const name = container.querySelector<HTMLElement>('[data-fit-name]');
    expect(name?.style.getPropertyValue('--kcp-name-lines')).toBe('');
    expect(name).toHaveClass('break-normal');
  });

  it('leaves out an empty foot so its margin never costs the name a line', () => {
    // The column overflows while it holds either foot line, so the fit drops the id, then the
    // time, the reclaim pass finds neither fits back, and the foot that held them goes too.
    overflowWhileShowing('09:00-12:00', '90592033');
    const { container } = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('09:00-12:00')).not.toBeInTheDocument();
    expect(screen.queryByText('90592033')).not.toBeInTheDocument();
    expect(container.querySelector('.mt-1')).toBeNull();
  });

  it('clamps the name to the lines that fit, measured from its line height', () => {
    // A column with 20 px of overflow under a name of six 15 px lines sheds two lines in one
    // step once the id and the time have gone, keeping the place and the chip.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        const name = this.querySelector<HTMLElement>('[data-fit-name]');
        return name !== null &&
          name.style.getPropertyValue('--kcp-name-lines') === ''
          ? 100
          : 80;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(90);
    const computed = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = computed(element);
      // jsdom resolves no line height, so the name reports the 15 px a layout would.
      return element.hasAttribute('data-fit-name')
        ? new Proxy(style, {
            get: (target, property): unknown => {
              if (property === 'lineHeight') {
                return '15px';
              }
              const value: unknown = Reflect.get(target, property, target);
              return value;
            },
          })
        : style;
    });
    const { container } = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const name = container.querySelector<HTMLElement>('[data-fit-name]');
    expect(name?.style.getPropertyValue('--kcp-name-lines')).toBe('4');
    expect(screen.getByText('A · A101')).toBeInTheDocument();
    expect(screen.getByText('901')).toBeInTheDocument();
  });

  it('shows the name alone on a block narrower than 7em under the name only rule', () => {
    const { container } = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        onRemove={vi.fn()}
        removeLabel={t('action.remove')}
        onOpenDetail={vi.fn()}
        nameOnlyWhenNarrow
      />,
    );
    // The wrapper is the size container the narrow rule queries.
    const block = screen.getByRole('button', { name: /90592033/ });
    expect(block.parentElement).toHaveClass('@container');
    expect(block).toHaveClass('@max-[7em]:pl-1.5', '@max-[7em]:pr-0.5');
    // The place row and the foot hide, and the remove control hides with them, since the
    // details the block opens carry Remove.
    expect(screen.getByText('901').parentElement).toHaveClass(
      '@max-[7em]:hidden',
    );
    expect(container.querySelector('.mt-1')).toHaveClass('@max-[7em]:hidden');
    expect(
      screen.getByRole('button', { name: t('action.remove') }),
    ).toHaveClass('@max-[7em]:hidden');
    // The name keeps clear of the remove corner only where that control can show.
    expect(container.querySelector('[data-fit-name]')).toHaveClass(
      'not-pointer-coarse:@min-[7em]:pr-5',
    );
  });

  it('keeps every field of a short landscape block without the name only rule', () => {
    // A 60 minute meeting in a landscape grid is under 7em wide, so the rule must not
    // apply there: the block walks the density ladder and keeps its place.
    const { container } = render(
      <EventBlock
        section={section}
        meeting={{ ...meeting, endMin: meeting.startMin + 60 }}
        style={{}}
        locale="th"
        t={t}
        onRemove={vi.fn()}
        removeLabel={t('action.remove')}
        onOpenDetail={vi.fn()}
      />,
    );
    const block = screen.getByRole('button', { name: /90592033/ });
    expect(block.parentElement).not.toHaveClass('@container');
    expect(container.querySelector('[class*="7em"]')).toBeNull();
    expect(screen.getByText('A · A101')).toBeVisible();
    expect(
      screen.getByRole('button', { name: t('action.remove') }),
    ).not.toHaveClass('@max-[7em]:hidden');
    expect(container.querySelector('[data-fit-name]')).toHaveClass(
      'not-pointer-coarse:pr-5',
    );
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

  it('tints the soft card with the subject stable color', () => {
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
    expect(block).toHaveClass('kcp-soft-card', 'kcp-soft-subject');
    expect(block.style.getPropertyValue('--kcp-tint')).toBe(
      hashColor('90592033'),
    );
    expect(block.style.backgroundColor).toBe('');
  });

  it('draws the danger ring on an overlay, apart from the soft fill', () => {
    const { container } = render(
      <EventBlock
        section={{ ...section, verifyStatus: 'missing' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    // The soft card draws its edge and shadow with box-shadow, so a ring on the block itself
    // would replace them; the overlay carries the ring instead.
    const ring = container.querySelector('.ring-danger');
    expect(ring).toHaveClass('ring-2', 'ring-inset', 'inset-0');
    expect(ring).not.toHaveClass('kcp-hatch');
    expect(screen.getByLabelText(/90592033/).className).not.toContain(
      'ring-danger',
    );
  });

  it('keeps the hatch to a band above the content, so no line sits on the stripes', () => {
    const { container } = render(
      <EventBlock
        section={{ ...section, verifyStatus: 'missing' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    const band = container.querySelector('[data-hatch-band]');
    expect(band).toHaveClass('kcp-hatch', 'top-0', 'inset-x-0', HATCH_BAND);
    expect(band).not.toHaveClass('inset-0');
    // The content clears the band with a deeper top padding than a plain block's.
    const block = screen.getByLabelText(/90592033/);
    expect(block).toHaveClass('pt-3.5', 'pb-1.5');
    expect(block).not.toHaveClass('py-1.5');
  });

  it('keeps the normal block anatomy under the danger state', () => {
    const plain = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    const plainClasses = Array.from(
      plain.container.querySelector('[data-fit]')?.querySelectorAll('*') ?? [],
    ).map((node) => node.getAttribute('class'));
    plain.unmount();
    const { container } = render(
      <EventBlock
        section={{ ...section, verifyStatus: 'missing' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    // The same lines in the same classes, the status dot aside: the section chip trails the
    // place at the row end, the quiet lines read ink soft on the card fill, and the accent
    // stripe still runs down the left edge.
    const dangerClasses = Array.from(
      container.querySelector('[data-fit]')?.querySelectorAll('*') ?? [],
    )
      .filter((node) => !node.classList.contains('rounded-full'))
      .map((node) => node.getAttribute('class'));
    expect(dangerClasses).toEqual(plainClasses);
    expect(screen.getByText('901')).toHaveClass('text-ink-soft');
    expect(screen.getByText('901').parentElement).toHaveClass(
      'justify-between',
    );
    expect(container.querySelector('.w-\\[3px\\]')).not.toBeNull();
  });

  it('draws no hatch on a block with no danger state', () => {
    const { container } = render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(container.querySelector('.kcp-hatch')).toBeNull();
    expect(screen.getByLabelText(/90592033/)).toHaveClass('py-1.5');
  });

  it('leads the name with the status dot in flow rather than over it', () => {
    const { container } = render(
      <EventBlock
        section={{ ...section, verifyStatus: 'changed' }}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    const dot = container.querySelector('.bg-warn');
    expect(dot).not.toBeNull();
    expect(dot?.className).not.toContain('absolute');
    expect(dot?.parentElement).toHaveAttribute('data-fit-name');
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

  it('adds the English name under a Thai primary when the name language is both', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    const block = screen.getByLabelText(/90592033/);
    expect(within(block).getByText('วิชาทดสอบ')).toBeInTheDocument();
    expect(within(block).getByText('Test subject')).toBeInTheDocument();
  });

  it('adds the Thai name under an English primary when the name language is both', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="en"
        t={createTranslator('en')}
        nameLanguage="both"
      />,
    );
    expect(screen.getAllByText('Test subject')).toHaveLength(1);
    expect(screen.getByText('Test subject')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('วิชาทดสอบ')).toHaveAttribute('lang', 'th');
  });

  it('names the block in the chosen language whatever the panel language', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="en"
      />,
    );
    expect(screen.getByText('Test subject')).toHaveAttribute('lang', 'en');
    expect(screen.queryByText('วิชาทดสอบ')).not.toBeInTheDocument();
  });

  it('keeps the subject id and the time on one line that never wraps', () => {
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    for (const text of ['90592033', '09:00-12:00']) {
      const field = screen.getByText(text);
      expect(field).toHaveClass('whitespace-nowrap', 'overflow-hidden');
      expect(field).not.toHaveClass('break-words');
      expect(field).toHaveAttribute('data-fit-whole');
    }
  });

  it('drops a subject id wider than its line whole and keeps the time and the place', () => {
    // The id measures wider than its line; every other field fits.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.fitWhole === 'id' ? 56 : 40;
      },
    );
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('90592033')).not.toBeInTheDocument();
    expect(screen.getByText('09:00-12:00')).toBeInTheDocument();
    expect(screen.getByText(/A101/)).toBeInTheDocument();
  });

  it('drops a time wider than its line whole and keeps the subject id', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.fitWhole === 'time' ? 62 : 40;
      },
    );
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('09:00-12:00')).not.toBeInTheDocument();
    expect(screen.getByText('90592033')).toBeInTheDocument();
  });

  it('gives the subject id back when the second name never fit under both names', () => {
    // The column overflows only while the English second line shows. The walk drops the id
    // first, then the second line; the reclaim pass then finds the id fits again.
    overflowWhileShowing('Test subject');
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
        nameLanguage="both"
      />,
    );
    expect(screen.queryByText('Test subject')).not.toBeInTheDocument();
    expect(screen.getByText('90592033')).toBeInTheDocument();
    expect(screen.getByText('09:00-12:00')).toBeInTheDocument();
  });

  it('walks the ladder when the content overflows sideways for any other reason', () => {
    // The column is wider than the box while the id shows, so the first rung drops it.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(40);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.hasAttribute('data-fit') &&
          this.textContent.includes('90592033')
          ? 60
          : 40;
      },
    );
    render(
      <EventBlock
        section={section}
        meeting={meeting}
        style={{}}
        locale="th"
        t={t}
      />,
    );
    expect(screen.queryByText('90592033')).not.toBeInTheDocument();
    expect(screen.getByText('09:00-12:00')).toBeInTheDocument();
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

  it('hides the remove control on a coarse pointer and keeps Enter opening the details', () => {
    const onOpenDetail = vi.fn();
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
        onOpenDetail={onOpenDetail}
      />,
    );
    // The remove control drops out of layout, the tab order and the accessibility tree
    // under a coarse pointer, and keeps the 24 px floor for a fine one.
    const remove = screen.getByRole('button', { name: t('action.remove') });
    expect(remove).toHaveClass('pointer-coarse:hidden');
    expect(remove).toHaveClass('min-h-(--kcp-target-min)');
    expect(remove).toHaveClass('min-w-(--kcp-target-min)');
    // The section chip steps aside for the remove control only where that control can
    // show, so a focused block on a coarse pointer keeps its corner chip.
    const chip = screen.getByText(section.section);
    expect(chip).toHaveClass(
      'not-pointer-coarse:group-hover/block:opacity-0',
      'not-pointer-coarse:group-focus-within/block:opacity-0',
    );
    expect(chip).not.toHaveClass('group-focus-within/block:opacity-0');

    // With the remove control gone, a keyboard reaches removal through the block itself:
    // Enter opens the detail surface, which carries the remove action.
    const block = screen.getByRole('button', { name: /90592033/ });
    expect(block).toHaveAttribute('tabindex', '0');
    expect(block).not.toHaveClass('pointer-coarse:hidden');
    block.focus();
    fireEvent.keyDown(block, { key: 'Enter' });
    expect(onOpenDetail).toHaveBeenCalledWith(block);
    expect(onRemove).not.toHaveBeenCalled();
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

  describe('the phone day card', () => {
    function renderCard(
      overrides: Partial<Meeting> = {},
      language: 'th' | 'en' = 'th',
      conflicted = false,
    ) {
      const translate = createTranslator(language);
      return render(
        <EventBlock
          section={section}
          meeting={{ ...meeting, ...overrides }}
          style={{}}
          locale={language}
          t={translate}
          nameLanguage="both"
          dayCard
          conflicted={conflicted}
          onRemove={vi.fn()}
          removeLabel={translate('action.remove')}
        />,
      );
    }

    it('reads top to bottom: the time, the names, the place, then the chips and the id', () => {
      renderCard();
      const card = document.querySelector<HTMLElement>('[data-day-card]');
      expect(card).not.toBeNull();
      const lines = Array.from(card?.children ?? []).map(
        (line) => line.textContent,
      );
      expect(lines).toEqual([
        '09:00-12:00',
        'วิชาทดสอบ',
        'Test subject',
        'A · A101',
        'กลุ่มเรียน 901ทฤษฎี90592033',
      ]);
    });

    it('sets the time as a whole field on the first line, clear of the remove control', () => {
      renderCard();
      const time = screen.getByText('09:00-12:00');
      expect(time).toHaveAttribute('data-fit-whole', 'time');
      expect(time).toHaveClass('font-semibold', 'whitespace-nowrap');
      expect(time.className).toContain('not-pointer-coarse:pr-6');
    });

    it('pins the chips and the id to the foot of the card', () => {
      renderCard();
      const foot = screen.getByText('กลุ่มเรียน 901').parentElement;
      if (foot === null) throw new Error('The chips have no foot');
      expect(foot).toHaveClass('mt-auto');
      expect(within(foot).getByText('ทฤษฎี')).toBeVisible();
      expect(within(foot).getByText('90592033')).toHaveAttribute(
        'data-fit-whole',
        'id',
      );
    });

    it('names a practice meeting and reads in English', () => {
      renderCard({ kind: 'practice' }, 'en');
      expect(screen.getByText('Section 901')).toBeInTheDocument();
      expect(screen.getByText('Practice')).toBeInTheDocument();
      expect(screen.getByText('Test subject')).toHaveAttribute('data-fit-name');
    });

    it('keeps the time on a short card and drops the chips before it', () => {
      // A one hour card cannot hold the chips: the column overflows while they show, so the
      // fit drops the id, the second name, clamps the name, and then the chips, and the time
      // the card leads with stays on its first line with the place.
      overflowWhileShowing('กลุ่มเรียน');
      renderCard({ startMin: 540, endMin: 600 });
      expect(screen.getByText('09:00-10:00')).toBeInTheDocument();
      expect(screen.getByText('A · A101')).toBeInTheDocument();
      expect(screen.queryByText('กลุ่มเรียน 901')).not.toBeInTheDocument();
      expect(screen.queryByText('90592033')).not.toBeInTheDocument();
      expect(screen.queryByText('Test subject')).not.toBeInTheDocument();
    });

    it('drops the place before the time on a card too short for both', () => {
      overflowWhileShowing('A · A101');
      renderCard({ startMin: 540, endMin: 570 });
      expect(screen.getByText('09:00-09:30')).toBeInTheDocument();
      expect(screen.queryByText('A · A101')).not.toBeInTheDocument();
      expect(screen.getByText('วิชาทดสอบ')).toBeInTheDocument();
    });

    it('keeps the hatch to a band above a danger card, with the id at the right edge', () => {
      const { container } = renderCard({}, 'th', true);
      const band = container.querySelector('[data-hatch-band]');
      expect(band).toHaveClass('kcp-hatch', 'top-0', HATCH_BAND);
      const card = screen.getByLabelText(/90592033/);
      expect(card).toHaveClass('pt-4', 'pb-2');
      const id = screen.getByText('90592033');
      expect(id).toHaveClass('ml-auto', 'text-ink-soft');
    });

    it('keeps the remove control beside the card', () => {
      renderCard();
      expect(screen.getByRole('button', { name: 'นำออก' })).toBeInTheDocument();
    });
  });
});
