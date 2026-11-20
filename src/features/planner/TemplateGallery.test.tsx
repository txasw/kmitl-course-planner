import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  within,
} from '@testing-library/react';
import { useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { EXPORT_TEMPLATES } from '@/lib/planner/exportTemplates';
import { buildExamSchedule } from '@/lib/planner/examSchedule';
import { resolveStageTemplate } from '@/lib/planner/previewStage';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { uiStore } from '@/features/shell/uiStore';
import { TemplateGallery } from './TemplateGallery';
import type { PosterData } from './PreviewPoster';

const t = createTranslator('th');

function makePoster(): PosterData {
  return {
    planName: 'ตาราง 1',
    term: { year: '2569', semester: '1' },
    sections: [],
    scheduled: [],
    unscheduled: [],
    window: DEFAULT_WINDOW,
    days: WEEK_DAYS,
    displayOptions: DEFAULT_DISPLAY_OPTIONS,
    honesty: {
      dataDate: { kind: 'unverified' },
      missingCount: 0,
      conflictPairCount: 0,
    },
    examSchedule: buildExamSchedule([]),
    locale: 'th',
    t,
  };
}

const posterRef: RefObject<HTMLDivElement | null> = { current: null };

// Stands in for the panel: it resolves the template from the choice and the reported stage
// shape, the way the planner panel does, so the gallery is exercised through its props.
function Harness({
  captureRef,
}: {
  captureRef: RefObject<HTMLDivElement | null>;
}) {
  const chosen = useStore(uiStore, (state) => state.selectedTemplate);
  const [tall, setTall] = useState(false);
  return (
    <TemplateGallery
      poster={makePoster()}
      posterRef={captureRef}
      template={resolveStageTemplate(chosen, tall)}
      onStageTallChange={setTall}
    />
  );
}

function renderGallery(captureRef = posterRef) {
  return render(<Harness captureRef={captureRef} />);
}

// jsdom performs no layout, so a stage reports a hand set client box, and resizes fire by hand.
function stubStage(initial: { width: number; height: number }) {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe(): void {
        /* resizes are fired by hand */
      }
      unobserve(): void {
        /* nothing to release */
      }
      disconnect(): void {
        /* nothing to release */
      }
    },
  );
  let stage = initial;
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(
    () => stage.width,
  );
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
    () => stage.height,
  );
  return (next: { width: number; height: number }) => {
    stage = next;
    act(() => {
      for (const callback of callbacks) callback();
    });
  };
}

function radioAt(index: number): HTMLElement {
  const radio = screen.getAllByRole('radio')[index];
  if (radio === undefined) {
    throw new Error(`no radio at index ${String(index)}`);
  }
  return radio;
}

// The stage viewport, which takes the swipe and the wheel; jsdom lacks pointer capture.
function stageOf(container: HTMLElement): HTMLElement {
  const stage = container.querySelector<HTMLElement>('.touch-pan-y');
  if (stage === null) {
    throw new Error('no stage');
  }
  stage.setPointerCapture = vi.fn();
  stage.releasePointerCapture = vi.fn();
  return stage;
}

function swipe(stage: HTMLElement, dx: number) {
  fireEvent.pointerDown(stage, { button: 0, pointerId: 1, clientX: 300 });
  fireEvent.pointerUp(stage, { button: 0, pointerId: 1, clientX: 300 + dx });
}

beforeEach(() => {
  act(() => {
    uiStore.getState().setSelectedTemplate(EXPORT_TEMPLATES[0]?.slug ?? '');
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The selected poster's scaled box, which the gallery sizes from the measured stage.
function selectedBox(container: HTMLElement): {
  width: number;
  height: number;
} {
  const box = container.querySelector<HTMLElement>('.kcp-settle');
  if (box === null) {
    throw new Error('no selected poster box');
  }
  return {
    width: Number.parseFloat(box.style.width),
    height: Number.parseFloat(box.style.height),
  };
}

describe('TemplateGallery', () => {
  it('renders one radio per template with the selected one checked', () => {
    renderGallery();
    expect(
      screen.getByRole('radiogroup', { name: 'แม่แบบ' }),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(EXPORT_TEMPLATES.length);
    // The first template is selected by default, so its radio is the checked one.
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    // Only the selected radio is in the tab order (roving tabindex).
    expect(radios[0]).toHaveAttribute('tabindex', '0');
    expect(radios[1]).toHaveAttribute('tabindex', '-1');
  });

  it('names every template on its chip with its exact output pixels', () => {
    renderGallery();
    const sizes = [
      '1920 × 1080',
      '2400 × 1080',
      '1080 × 2340',
      '2048 × 2732',
      '2732 × 2048',
      '3508 × 2480',
    ];
    EXPORT_TEMPLATES.forEach((template, index) => {
      const chip = radioAt(index);
      const size = sizes[index] ?? '';
      // The name and the size show on the chip itself, not only in a tooltip or a caption.
      expect(chip).toHaveTextContent(t(template.labelKey));
      expect(within(chip).getByText(size)).toBeVisible();
      expect(chip).toHaveAccessibleName(`${t(template.labelKey)} · ${size}`);
    });
    // The chips carry no tooltip, so nothing opens over the stage or the chips.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('marks the selected chip by a check glyph and weight, not by colour alone', () => {
    renderGallery();
    const selected = radioAt(0);
    const other = radioAt(1);
    expect(selected.querySelector('.lucide-check')).not.toBeNull();
    expect(other.querySelector('.lucide-check')).toBeNull();
    expect(within(selected).getByText('แชร์ 16:9')).toHaveClass('font-semibold');
    expect(
      within(other).getByText(t('preview.template.phone')),
    ).not.toHaveClass('font-semibold');
    // A device glyph names an unselected chip, turned on its side for a landscape canvas.
    expect(other.querySelector('.lucide-smartphone')).toHaveClass('rotate-90');
    expect(radioAt(2).querySelector('.lucide-smartphone')).not.toHaveClass(
      'rotate-90',
    );
    expect(radioAt(5).querySelector('.lucide-printer')).not.toBeNull();
  });

  it('draws keyboard focus as an offset outline, apart from the inset selected edge', () => {
    renderGallery();
    const selected = radioAt(0);
    // The selected edge is an inset ring, and focus always lands on the selected chip, so
    // focus draws outside the chip rather than as a second inset ring on the same edge.
    expect(selected).toHaveClass('ring-inset');
    expect(selected).toHaveClass(...FOCUS_OUTLINE.split(' '));
    for (const name of FOCUS_RING.split(' ').filter((n) =>
      n.includes('ring'),
    )) {
      expect(selected).not.toHaveClass(name);
    }
  });

  it('selects a template when its chip is clicked', () => {
    renderGallery();
    const target = EXPORT_TEMPLATES[2];
    fireEvent.click(
      screen.getByRole('radio', {
        name: new RegExp(t(target?.labelKey ?? 'preview.template.share')),
      }),
    );
    expect(uiStore.getState().selectedTemplate).toBe(target?.slug);
  });

  it('pages with the arrow keys and clamps at the ends', () => {
    renderGallery();
    const last = EXPORT_TEMPLATES.length - 1;
    // Right moves to the next template.
    fireEvent.keyDown(radioAt(0), { key: 'ArrowRight' });
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[1]?.slug);
    // End jumps to the last, and Right there clamps rather than wrapping.
    fireEvent.keyDown(radioAt(1), { key: 'End' });
    expect(uiStore.getState().selectedTemplate).toBe(
      EXPORT_TEMPLATES[last]?.slug,
    );
    fireEvent.keyDown(radioAt(last), { key: 'ArrowRight' });
    expect(uiStore.getState().selectedTemplate).toBe(
      EXPORT_TEMPLATES[last]?.slug,
    );
    // Home returns to the first.
    fireEvent.keyDown(radioAt(last), { key: 'Home' });
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[0]?.slug);
  });

  it('heads the stage with the chips and keeps no arrow rails or caption', () => {
    const { container } = renderGallery();
    // The chips choose directly, so the paging arrows and the caption are gone.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/ · /)).not.toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'แม่แบบ' });
    expect(
      group.compareDocumentPosition(stageOf(container)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('scales the selected poster from the measured stage and follows a resize', () => {
    const resize = stubStage({ width: 1000, height: 600 });
    const { container } = renderGallery();
    // Share 16:9 lays out at 960 by 540. The 1000 px stage keeps 60 px clear at each edge, so
    // the width bound of 880 / 960 wins over the height bound.
    const wide = selectedBox(container);
    expect(wide.width).toBeCloseTo(880);
    expect(wide.height).toBeCloseTo(495);

    resize({ width: 1080, height: 300 });
    // Now the height bound wins: 300 * 0.94 / 540 of the layout box.
    const scale = (300 * 0.94) / 540;
    const resized = selectedBox(container);
    expect(resized.width).toBeCloseTo(960 * scale);
    expect(resized.height).toBeCloseTo(540 * scale);

    // A large stage scales the poster past its layout box, up to the cap of two.
    resize({ width: 4000, height: 3000 });
    expect(selectedBox(container)).toEqual({ width: 1920, height: 1080 });
  });

  it('drops the slivers on a narrow stage', () => {
    const resize = stubStage({ width: 1200, height: 600 });
    const { container } = renderGallery();
    // A wide stage shows the selected poster and, at the first template, the next sliver.
    expect(container.querySelectorAll('.kcp-poster')).toHaveLength(2);

    resize({ width: 600, height: 400 });
    // Below 900 px only the selected poster renders, at 0.94 of the full width.
    expect(container.querySelectorAll('.kcp-poster')).toHaveLength(1);
    expect(selectedBox(container).width).toBeCloseTo(600 * 0.94);

    // Swipe still pages on a narrow stage.
    swipe(stageOf(container), -100);
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[1]?.slug);
  });

  it('pages by swipe and clamps at the first and last template', () => {
    const { container } = renderGallery();
    const stage = stageOf(container);
    const last = EXPORT_TEMPLATES.length - 1;
    // A swipe toward the previous page at the first template stays on the first.
    swipe(stage, 100);
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[0]?.slug);
    // A short drag below the threshold does not page.
    swipe(stage, -20);
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[0]?.slug);
    fireEvent.keyDown(radioAt(0), { key: 'End' });
    // A swipe toward the next page at the last template stays on the last.
    swipe(stage, -100);
    expect(uiStore.getState().selectedTemplate).toBe(
      EXPORT_TEMPLATES[last]?.slug,
    );
    swipe(stage, 100);
    expect(uiStore.getState().selectedTemplate).toBe(
      EXPORT_TEMPLATES[last - 1]?.slug,
    );
  });

  it('pages one template per wheel notch and keeps the page from scrolling', () => {
    vi.useFakeTimers();
    const { container } = renderGallery();
    const stage = stageOf(container);
    // A vertical notch pages forward and its default scroll is prevented.
    expect(fireEvent.wheel(stage, { deltaY: 100 })).toBe(false);
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[1]?.slug);
    // A second notch inside the cooldown is swallowed without paging.
    expect(fireEvent.wheel(stage, { deltaY: 100 })).toBe(false);
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[1]?.slug);
    act(() => {
      vi.advanceTimersByTime(320);
    });
    // A dominant horizontal delta pages by its own sign.
    fireEvent.wheel(stage, { deltaX: -100, deltaY: 10 });
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[0]?.slug);
    act(() => {
      vi.advanceTimersByTime(320);
    });
    // A tiny delta is left to the page and does not page.
    expect(fireEvent.wheel(stage, { deltaY: 2 })).toBe(true);
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[0]?.slug);
  });

  it('opens a tall stage on the portrait phone wallpaper when nothing is chosen', () => {
    act(() => {
      uiStore.setState({ selectedTemplate: null });
    });
    const resize = stubStage({ width: 360, height: 640 });
    renderGallery();
    expect(
      screen.getByRole('radio', { name: /ภาพพื้นหลังโทรศัพท์แนวตั้ง/ }),
    ).toHaveAttribute('aria-checked', 'true');
    // The stage shape alone records no choice, and a wide stage returns to the default.
    expect(uiStore.getState().selectedTemplate).toBeNull();
    resize({ width: 1200, height: 600 });
    expect(radioAt(0)).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps a chosen template on a tall stage', () => {
    stubStage({ width: 360, height: 640 });
    renderGallery();
    // The default share template is the chosen one here, so the tall stage leaves it.
    expect(radioAt(0)).toHaveAttribute('aria-checked', 'true');
  });

  it('frames the scaled wrapper, never the capture node', () => {
    const ref: RefObject<HTMLDivElement | null> = { current: null };
    const { container } = renderGallery(ref);
    const frame = container.querySelector<HTMLElement>('[data-poster-frame]');
    expect(frame).not.toBeNull();
    expect(frame).toHaveClass('shadow-kcp', 'ring-1');
    // The capture node is the bare poster inside the frame, so the export carries no frame.
    const poster = ref.current;
    expect(poster).not.toBeNull();
    expect(frame?.contains(poster ?? null)).toBe(true);
    expect(poster).not.toHaveClass('shadow-kcp');
    expect(poster).not.toHaveClass('rounded-kcp');
  });
});
