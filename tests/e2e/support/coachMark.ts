// The search page coach mark as the specs see it (ADR-0072), and the layout guard every
// width and language is held to: the callout, both buttons and the launcher sit wholly in
// the viewport, none of them covers another, the pointer and the burst strokes cover none
// of them, no text overflows its box, and a press at the centre of each control lands on
// that control, so the spotlit launcher is reachable through the scrim.

import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export const COACH_MARK = {
  th: {
    callout: 'ลองใช้ดูสิ',
    later: 'ลองภายหลัง',
    notToday: 'ไม่แสดงอีกวันนี้',
    launcher: 'เปิด KCP: Course Planner for KMITL',
  },
  en: {
    callout: 'Give it a try',
    later: 'Maybe later',
    notToday: 'Not again today',
    launcher: 'Open KCP: Course Planner for KMITL',
  },
} as const;

export type CoachLanguage = keyof typeof COACH_MARK;

/** The coach mark dialog, found by the callout that labels it. */
export function coachMark(page: Page, language: CoachLanguage = 'th'): Locator {
  return page.getByRole('dialog', { name: COACH_MARK[language].callout });
}

interface Rect {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Measured {
  boxes: Rect[];
  decorations: Rect[];
  overflowing: string[];
  missedHits: string[];
}

// Subpixel layout can place an edge a fraction past a whole pixel.
const TOLERANCE = 0.5;

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right - TOLERANCE &&
    b.left < a.right - TOLERANCE &&
    a.top < b.bottom - TOLERANCE &&
    b.top < a.bottom - TOLERANCE
  );
}

async function measure(page: Page, language: CoachLanguage): Promise<Measured> {
  const copy = COACH_MARK[language];
  return page.evaluate((names) => {
    const host = document.querySelector('kcp-planner-root');
    const root = host?.shadowRoot;
    if (root === null || root === undefined) {
      throw new Error('The debug build mounts an open shadow root');
    }
    const dialog = root.querySelector('[data-coach-mark] [role="dialog"]');
    const launcher = root.getElementById('kcp-launcher');
    if (dialog === null || launcher === null) {
      throw new Error('The coach mark or the launcher is not mounted');
    }
    const buttons = [...dialog.querySelectorAll('button')];
    const button = (label: string): HTMLElement => {
      const found = buttons.find((node) => node.textContent === label);
      if (found === undefined) throw new Error(`No button ${label}`);
      return found;
    };
    const callout = dialog.querySelector('p');
    if (callout === null) throw new Error('No callout');
    const controls: [string, Element][] = [
      ['callout', callout],
      ['not today', button(names.notToday)],
      ['later', button(names.later)],
      ['launcher', launcher],
    ];
    const rect = (name: string, node: Element) => {
      const box = node.getBoundingClientRect();
      return {
        name,
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      };
    };
    const decorations = [...dialog.querySelectorAll('svg path')]
      // The underline sits under the callout by design, and the spacer's hidden copy of
      // the launcher face is covered by the launcher itself.
      .filter(
        (node) =>
          node.closest('p') === null && node.closest('.invisible') === null,
      )
      .map((node, index) => rect(`stroke ${String(index)}`, node));
    const overflowing = controls
      .filter(([, node]) => {
        const element = node as HTMLElement;
        return (
          element.scrollWidth > element.clientWidth + 1 ||
          element.scrollHeight > element.clientHeight + 1
        );
      })
      .map(([name]) => name);
    const missedHits = controls
      .filter(([name]) => name !== 'callout')
      .filter(([, node]) => {
        const box = node.getBoundingClientRect();
        const hit = root.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return hit === null || !node.contains(hit);
      })
      .map(([name]) => name);
    return {
      boxes: controls.map(([name, node]) => rect(name, node)),
      decorations,
      overflowing,
      missedHits,
    };
  }, copy);
}

/** Assert the coach mark lays out with no overlap and no clipped text at this size. */
export async function expectCoachMarkLaidOut(
  page: Page,
  language: CoachLanguage,
): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('The project sets no viewport');
  const { boxes, decorations, overflowing, missedHits } = await measure(
    page,
    language,
  );

  for (const box of boxes) {
    expect(box.left, `${box.name} left`).toBeGreaterThanOrEqual(0);
    expect(box.top, `${box.name} top`).toBeGreaterThanOrEqual(0);
    expect(box.right, `${box.name} right`).toBeLessThanOrEqual(
      viewport.width + TOLERANCE,
    );
    expect(box.bottom, `${box.name} bottom`).toBeLessThanOrEqual(
      viewport.height + TOLERANCE,
    );
  }
  const pairs = boxes.flatMap((a, index) =>
    boxes.slice(index + 1).map((b) => [a, b] as const),
  );
  const crossing = [
    ...pairs,
    ...decorations.flatMap((stroke) =>
      boxes.map((box) => [stroke, box] as const),
    ),
  ]
    .filter(([a, b]) => overlaps(a, b))
    .map(([a, b]) => `${a.name} over ${b.name}`);
  expect(crossing).toEqual([]);
  expect(overflowing).toEqual([]);
  expect(missedHits).toEqual([]);
}
