import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createTranslator, type Locale } from '@/lib/i18n/t';
import { suggestPlans } from '@/lib/planner/suggest';
import { byClassCourses, lockSections } from '../../../tests/support/suggest';
import { swipe } from '../../../tests/support/swipe';
import { installViewport } from '../../../tests/support/viewport';
import { SuggestionCarousel, type SuggestionView } from './SuggestionCarousel';
import { movedFrom, sharedFrame, suggestionSections } from './suggestionFrame';

const courses = byClassCourses();
const locked = lockSections(courses, [['04186098', '2']]);
const allCards: SuggestionView[] = suggestPlans({
  courses,
  entries: locked,
  objective: 'coverAll',
  preference: 'balanced',
}).suggestions.map((suggestion) => ({
  suggestion,
  sections: suggestionSections(locked, suggestion),
  movedFrom: movedFrom(locked, suggestion),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({
  cards,
  locale,
  onApply,
}: {
  cards: readonly SuggestionView[];
  locale: Locale;
  onApply: () => void;
}) {
  const [page, setPage] = useState(0);
  return (
    <SuggestionCarousel
      cards={cards}
      frame={sharedFrame(cards.map((card) => card.sections))}
      orientation="landscape"
      page={page}
      onPageChange={setPage}
      busy={false}
      locale={locale}
      t={createTranslator(locale)}
      onApply={onApply}
    />
  );
}

function renderCarousel({
  count = 3,
  locale = 'th',
  reducedMotion = false,
}: { count?: number; locale?: Locale; reducedMotion?: boolean } = {}) {
  installViewport(1366, { reducedMotion });
  const onApply = vi.fn();
  render(
    <Harness
      cards={allCards.slice(0, count)}
      locale={locale}
      onApply={onApply}
    />,
  );
  return { onApply };
}

/** The slide that is shown, the one slide that is not inert. */
function shownSlide(): HTMLElement {
  const shown = document.querySelectorAll<HTMLElement>(
    '[data-suggest-slide]:not([inert])',
  );
  const [only] = shown;
  if (shown.length !== 1 || only === undefined) {
    throw new Error(`expected one shown slide, found ${String(shown.length)}`);
  }
  return only;
}

function shownHeading(): string {
  return within(shownSlide()).getByRole('heading').textContent;
}

function viewport(): HTMLElement {
  return screen.getByRole('group', { name: /^ตัวเลือก \d จาก \d$/ });
}

function dot(number: number): HTMLElement {
  return screen.getByRole('button', { name: `ตัวเลือกที่ ${String(number)}` });
}

function liveRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]');
  if (region === null) throw new Error('expected the position live region');
  return region;
}

describe('SuggestionCarousel', () => {
  it('shows one suggestion per slide with its grid, facts, and apply action', () => {
    const { onApply } = renderCarousel();
    expect(document.querySelectorAll('[data-suggest-slide]')).toHaveLength(3);
    const slide = shownSlide();
    expect(shownHeading()).toBe('ตัวเลือกที่ 1');
    expect(
      within(slide).getByRole('group', { name: 'ตารางเรียนรายสัปดาห์' }),
    ).toBeInTheDocument();
    expect(within(slide).getByText('เริ่มเร็วสุด')).toBeInTheDocument();
    fireEvent.click(within(slide).getByRole('button', { name: 'ใช้ตารางนี้' }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 1 จาก 3');
    expect(dot(1)).toHaveAttribute('aria-current', 'true');
    expect(dot(2)).not.toHaveAttribute('aria-current');
    // The slide area and each slide name the pattern.
    expect(viewport()).toHaveAttribute('aria-roledescription', 'ชุดสไลด์');
    expect(within(slide).getByRole('article')).toHaveAttribute(
      'aria-roledescription',
      'สไลด์',
    );
    // Only the shown dot is a tab stop; the keys reach the others.
    expect(dot(1)).toHaveAttribute('tabindex', '0');
    expect(dot(2)).toHaveAttribute('tabindex', '-1');
    expect(dot(3)).toHaveAttribute('tabindex', '-1');
  });

  it('pages with the chevrons and announces the position', () => {
    renderCarousel();
    const previous = screen.getByRole('button', { name: 'ตัวเลือกก่อนหน้า' });
    const next = screen.getByRole('button', { name: 'ตัวเลือกถัดไป' });
    expect(previous).toBeDisabled();

    fireEvent.click(next);
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 2 จาก 3');
    expect(dot(2)).toHaveAttribute('aria-current', 'true');
    expect(previous).toBeEnabled();

    // The last step disables the next chevron, so focus moves to the previous chevron
    // beside it rather than to a dot below the slide.
    fireEvent.click(next);
    expect(shownHeading()).toBe('ตัวเลือกที่ 3');
    expect(next).toBeDisabled();
    expect(previous).toHaveFocus();

    fireEvent.click(previous);
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 2 จาก 3');
    expect(previous).toHaveFocus();

    // The first step back disables the previous chevron, so focus moves to the next one.
    fireEvent.click(previous);
    expect(shownHeading()).toBe('ตัวเลือกที่ 1');
    expect(previous).toBeDisabled();
    expect(next).toHaveFocus();
  });

  it('opens no tooltip on a chevron, since the position line names the page', () => {
    renderCarousel();
    const next = screen.getByRole('button', { name: 'ตัวเลือกถัดไป' });
    fireEvent.focus(next);
    fireEvent.mouseEnter(next);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('jumps to a suggestion from its dot', () => {
    renderCarousel();
    fireEvent.click(dot(3));
    expect(shownHeading()).toBe('ตัวเลือกที่ 3');
    expect(dot(3)).toHaveAttribute('aria-current', 'true');
    expect(dot(3)).toHaveAttribute('tabindex', '0');
    expect(dot(1)).toHaveAttribute('tabindex', '-1');
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 3 จาก 3');
  });

  it('pages with the left and right arrow keys, Home, and End', () => {
    renderCarousel();
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 3');
    fireEvent.keyDown(viewport(), { key: 'ArrowLeft' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 2 จาก 3');

    // On a dot, the keys move focus with the page.
    dot(2).focus();
    fireEvent.keyDown(dot(2), { key: 'Home' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 1');
    expect(dot(1)).toHaveFocus();
    fireEvent.keyDown(dot(1), { key: 'End' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 3');
    expect(dot(3)).toHaveFocus();
  });

  it('moves focus to the carousel when a key pages from inside the slide', () => {
    renderCarousel();
    const apply = within(shownSlide()).getByRole('button', {
      name: 'ใช้ตารางนี้',
    });
    apply.focus();
    fireEvent.keyDown(apply, { key: 'ArrowRight' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    expect(apply.closest('[data-suggest-slide]')).toHaveAttribute('inert');
    expect(viewport()).toHaveFocus();
  });

  it('pages on a swipe across the slide, clamped at the ends', () => {
    renderCarousel();
    swipe(viewport(), 'x', 100);
    expect(shownHeading()).toBe('ตัวเลือกที่ 1');
    swipe(viewport(), 'x', -100);
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 2 จาก 3');
    swipe(viewport(), 'x', -100);
    swipe(viewport(), 'x', -100);
    expect(shownHeading()).toBe('ตัวเลือกที่ 3');
    swipe(viewport(), 'x', 100);
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
    // A short drag springs back without paging.
    swipe(viewport(), 'x', -40);
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
  });

  it('slides the track unless reduced motion is set', () => {
    renderCarousel();
    const track = shownSlide().parentElement;
    expect(track?.style.transform).toBe('translateX(0%)');
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกถัดไป' }));
    expect(track?.style.transform).toBe('translateX(-100%)');
    expect(track?.className).toMatch(/transition-transform/);
    expect(track?.className).toMatch(/motion-reduce:transition-none/);
  });

  it('does not follow the finger under reduced motion, yet still pages', () => {
    renderCarousel({ reducedMotion: true });
    const track = shownSlide().parentElement;
    if (track === null) throw new Error('no track');
    fireEvent.pointerDown(viewport(), {
      button: 0,
      pointerId: 1,
      clientX: 200,
      clientY: 100,
    });
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
    try {
      fireEvent.pointerMove(viewport(), {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      expect(track.style.transform).toBe('translateX(0%)');
      fireEvent.pointerUp(viewport(), {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
    } finally {
      Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
    }
    expect(shownHeading()).toBe('ตัวเลือกที่ 2');
  });

  it('moves the track with the finger, without a fade, and slides on from there', () => {
    renderCarousel();
    const track = shownSlide().parentElement;
    if (track === null) throw new Error('no track');
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
    try {
      fireEvent.pointerDown(viewport(), {
        button: 0,
        pointerId: 1,
        clientX: 200,
        clientY: 100,
      });
      fireEvent.pointerMove(viewport(), {
        pointerId: 1,
        clientX: 140,
        clientY: 100,
      });
      // 60 px of travel less the 24 px slop.
      expect(track.style.transform).toBe('translateX(calc(0% - 36px))');
      expect(track.style.transition).toBe('none');
      expect(track.style.opacity).toBe('');
      fireEvent.pointerUp(viewport(), {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      // The release clears the drag in the same update that pages, so the transition
      // carries the track on from where the finger let go.
      expect(shownHeading()).toBe('ตัวเลือกที่ 2');
      expect(track.style.transform).toBe('translateX(-100%)');
      expect(track.style.transition).toBe('');
    } finally {
      fireEvent.pointerCancel(viewport());
      Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
    }
  });

  it('resists a drag past the first slide', () => {
    renderCarousel();
    const track = shownSlide().parentElement;
    if (track === null) throw new Error('no track');
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
    try {
      fireEvent.pointerDown(viewport(), {
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(viewport(), {
        pointerId: 1,
        clientX: 160,
        clientY: 100,
      });
      // A third of the 36 px the finger travelled past the slop.
      expect(track.style.transform).toBe('translateX(calc(0% + 12px))');
    } finally {
      fireEvent.pointerCancel(viewport());
      Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
    }
  });

  it('keeps claiming a sideways touch move across the renders of a swipe', () => {
    renderCarousel();
    const touch = (x: number, y: number) => ({
      touches: [{ clientX: x, clientY: y }],
    });
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
    try {
      fireEvent.touchStart(viewport(), touch(200, 100));
      // The pointer moves past the slop and the follower renders, as a real swipe does
      // between its touch moves.
      fireEvent.pointerDown(viewport(), {
        button: 0,
        pointerId: 1,
        clientX: 200,
        clientY: 100,
      });
      fireEvent.pointerMove(viewport(), {
        pointerId: 1,
        clientX: 140,
        clientY: 100,
      });
      // fireEvent returns false when a listener cancelled the event.
      expect(fireEvent.touchMove(viewport(), touch(130, 102))).toBe(false);
    } finally {
      fireEvent.pointerCancel(viewport());
      Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
    }
  });

  it('shows fewer dots for fewer suggestions', () => {
    renderCarousel({ count: 2 });
    const dots = within(
      screen.getByRole('group', { name: 'ตัวเลือกตาราง' }),
    ).getAllByRole('button');
    expect(dots).toHaveLength(2);
    expect(liveRegion()).toHaveTextContent('ตัวเลือก 1 จาก 2');
  });

  it('shows no navigation for a single suggestion', () => {
    renderCarousel({ count: 1 });
    expect(shownHeading()).toBe('ตัวเลือกที่ 1');
    expect(screen.queryByRole('button', { name: 'ตัวเลือกถัดไป' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ตัวเลือกก่อนหน้า' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'ตัวเลือกตาราง' })).toBeNull();
    expect(document.querySelector('[aria-live]')).toBeNull();
    expect(document.querySelector('[aria-roledescription]')).toBeNull();
    // A key or a swipe does nothing with nowhere to go.
    const slide = shownSlide();
    fireEvent.keyDown(slide, { key: 'ArrowRight' });
    expect(shownHeading()).toBe('ตัวเลือกที่ 1');
  });

  it('leaves the pager and the apply action to a footer that names its position line', () => {
    installViewport(390);
    const cards = allCards.slice(0, 3);
    render(
      <>
        <SuggestionCarousel
          cards={cards}
          frame={sharedFrame(cards.map((card) => card.sections))}
          orientation="portrait"
          page={0}
          onPageChange={vi.fn()}
          busy={false}
          locale="th"
          t={createTranslator('th')}
          onApply={vi.fn()}
          externalPagerId="footer-position"
        />
        <p id="footer-position">ตัวเลือก 1 จาก 3</p>
      </>,
    );
    expect(screen.queryByRole('button', { name: 'ตัวเลือกถัดไป' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ใช้ตารางนี้' })).toBeNull();
    expect(document.querySelector('[aria-live]')).toBeNull();
    expect(viewport()).toHaveAttribute('aria-labelledby', 'footer-position');
    // The dots stay with the slides.
    expect(
      within(screen.getByRole('group', { name: 'ตัวเลือกตาราง' })).getAllByRole(
        'button',
      ),
    ).toHaveLength(3);
  });

  it('names the controls and the position in English', () => {
    renderCarousel({ locale: 'en' });
    expect(
      screen.getByRole('button', { name: 'Previous option' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next option' }));
    expect(liveRegion()).toHaveTextContent('Option 2 of 3');
    expect(
      screen.getByRole('group', { name: 'Option 2 of 3' }),
    ).toHaveAttribute('aria-roledescription', 'carousel');
    expect(
      document.querySelector('[data-suggest-slide="1"] article'),
    ).toHaveAttribute('aria-roledescription', 'slide');
    expect(screen.getByRole('button', { name: 'Option 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
