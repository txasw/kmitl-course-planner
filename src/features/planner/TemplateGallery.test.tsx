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
    conflictIds: new Set(),
    examConflictIds: new Set(),
    examOverlaps: new Map(),
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
});

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
});
