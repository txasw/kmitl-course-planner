import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import type { RefObject } from 'react';
import { createTranslator } from '@/lib/i18n/t';
import { DEFAULT_WINDOW } from '@/lib/planner/grid';
import { WEEK_DAYS } from '@/lib/parsing/days';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { EXPORT_TEMPLATES } from '@/lib/planner/exportTemplates';
import { buildExamSchedule } from '@/lib/planner/examSchedule';
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

function renderGallery() {
  return render(
    <TemplateGallery poster={makePoster()} posterRef={posterRef} />,
  );
}

function radioAt(index: number): HTMLElement {
  const radio = screen.getAllByRole('radio')[index];
  if (radio === undefined) {
    throw new Error(`no radio at index ${String(index)}`);
  }
  return radio;
}

beforeEach(() => {
  act(() => {
    uiStore.getState().setSelectedTemplate(EXPORT_TEMPLATES[0]?.slug ?? '');
  });
});

afterEach(() => {
  cleanup();
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

  it('captions the selected template with its exact output dimensions', () => {
    renderGallery();
    // Share 16:9 is the default: 1920 by 1080.
    expect(screen.getByText(/แชร์ 16:9 · 1920 × 1080/)).toBeInTheDocument();
  });

  it('selects a template when its dot is clicked', () => {
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

  it('pages with the arrow buttons and disables them at the clamped ends', () => {
    renderGallery();
    // At the first template there is no previous, matching the clamp boundary.
    expect(
      screen.getByRole('button', { name: 'แม่แบบก่อนหน้า' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'แม่แบบถัดไป' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'แม่แบบถัดไป' }));
    expect(uiStore.getState().selectedTemplate).toBe(EXPORT_TEMPLATES[1]?.slug);
    // At the last template the next arrow disables and the previous enables.
    fireEvent.keyDown(radioAt(1), { key: 'End' });
    expect(screen.getByRole('button', { name: 'แม่แบบถัดไป' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'แม่แบบก่อนหน้า' }),
    ).toBeEnabled();
  });

  it('scales the selected poster from the measured stage and follows a resize', () => {
    const callbacks: (() => void)[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          callbacks.push(callback);
        }
        observe(): void {
          /* resizes are fired by hand below */
        }
        unobserve(): void {
          /* nothing to release */
        }
        disconnect(): void {
          /* nothing to release */
        }
      },
    );
    // jsdom performs no layout, so the stage reports a hand set client box.
    let stage = { width: 600, height: 400 };
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(
      () => stage.width,
    );
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
      () => stage.height,
    );
    const { container } = renderGallery();
    // Share 16:9 lays out at 960 by 540. The 600 px stage keeps 60 px clear at each edge, so
    // the width bound of 480 / 960 wins over the height bound.
    expect(selectedBox(container)).toEqual({ width: 480, height: 270 });

    stage = { width: 1080, height: 300 };
    act(() => {
      for (const callback of callbacks) callback();
    });
    // Now the height bound wins: 300 * 0.94 / 540 of the layout box.
    const scale = (300 * 0.94) / 540;
    const resized = selectedBox(container);
    expect(resized.width).toBeCloseTo(960 * scale);
    expect(resized.height).toBeCloseTo(540 * scale);

    // A large stage scales the poster past its layout box, up to the cap of two.
    stage = { width: 4000, height: 3000 };
    act(() => {
      for (const callback of callbacks) callback();
    });
    expect(selectedBox(container)).toEqual({ width: 1920, height: 1080 });
  });

  it('frames the scaled wrapper, never the capture node', () => {
    const ref: RefObject<HTMLDivElement | null> = { current: null };
    const { container } = render(
      <TemplateGallery poster={makePoster()} posterRef={ref} />,
    );
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
