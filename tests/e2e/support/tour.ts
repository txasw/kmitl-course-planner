// The product tour as the end to end specs see it (ADR-0074): its card, its copy in both
// languages, and the layout guard every step must pass. The card is found by its data
// attribute, since its accessible name is the step title and the catalog sheet carries a
// dialog name that one of the titles shares.

import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export const TOUR = {
  th: {
    titles: {
      search: 'ค้นหารายวิชา',
      add: 'เพิ่มกลุ่มเรียนลงตาราง',
      timetable: 'ดูตารางเรียน',
      suggest: 'แนะนำตาราง',
      export: 'ส่งออกตาราง',
    },
    count: (current: number, total: number) =>
      `${String(current)} จาก ${String(total)}`,
    next: 'ถัดไป',
    back: 'ย้อนกลับ',
    finish: 'เสร็จสิ้น',
    skip: 'ข้าม',
    menu: 'แนะนำการใช้งาน',
    more: 'ตัวเลือกเพิ่มเติม',
  },
  en: {
    titles: {
      search: 'Search for courses',
      add: 'Add a section to the timetable',
      timetable: 'Read your timetable',
      suggest: 'Suggest a plan',
      export: 'Export your timetable',
    },
    count: (current: number, total: number) =>
      `${String(current)} of ${String(total)}`,
    next: 'Next',
    back: 'Back',
    finish: 'Finish',
    skip: 'Skip',
    menu: 'Product tour',
    more: 'More options',
  },
} as const;

export type TourLanguage = keyof typeof TOUR;
export type TourStepName = keyof (typeof TOUR)['th']['titles'];

export function tourCard(page: Page): Locator {
  return page.locator('[data-tour-card]');
}

/** What the layout guard found wrong with a step, empty when it holds. */
interface LayoutFaults {
  faults: string[];
}

/**
 * The owner's layout rule for one step: the card and the spotlight lie wholly in the
 * viewport, the card never covers the spotlight and rests above a phone bottom nav, no
 * text in the card overflows or is cut by its box, its buttons neither overlap nor leave
 * the card, and a press at each button's centre lands on that button rather than on
 * something laid over it.
 */
export async function expectTourStepLaidOut(
  page: Page,
  label = 'the tour step',
): Promise<void> {
  const card = tourCard(page);
  await expect(card).toBeVisible();
  const { faults } = await card.evaluate((node): LayoutFaults => {
    const found: string[] = [];
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot)) return { faults: ['no shadow root'] };
    const spot = root.querySelector('[data-tour-spot]');
    if (!(spot instanceof HTMLElement)) return { faults: ['no spotlight'] };
    const width = window.innerWidth;
    const height = window.innerHeight;
    const box = node.getBoundingClientRect();
    const lit = spot.getBoundingClientRect();
    const inView = (rect: DOMRect) =>
      rect.left >= -0.5 &&
      rect.top >= -0.5 &&
      rect.right <= width + 0.5 &&
      rect.bottom <= height + 0.5;
    const overlap = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 &&
      b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 &&
      b.top < a.bottom - 0.5;
    if (!inView(box)) found.push('card leaves the viewport');
    if (!inView(lit)) found.push('spotlight leaves the viewport');
    if (lit.width < 8 || lit.height < 8) found.push('spotlight has no box');
    if (overlap(box, lit)) found.push('card covers the spotlight');
    // On a phone the card rests above the bottom nav with a gutter, rather than cutting
    // through the nav labels.
    const nav = root.querySelector('[data-bottom-nav]');
    if (nav !== null) {
      const navTop = nav.getBoundingClientRect().top;
      if (box.bottom > navTop - 8 + 0.5) {
        found.push(
          `card reaches the bottom nav: ${box.bottom.toFixed(1)} past ${(navTop - 8).toFixed(1)}`,
        );
      }
    }
    for (const text of node.querySelectorAll<HTMLElement>(
      'h2, p:not(.sr-only), span, button',
    )) {
      if (text.closest('[aria-hidden="true"]') !== null) continue;
      if (
        text.scrollWidth > text.clientWidth + 1 ||
        text.scrollHeight > text.clientHeight + 1
      ) {
        found.push(`text overflows: ${text.textContent}`);
      }
      if (window.getComputedStyle(text).textOverflow === 'ellipsis') {
        found.push(`text is clamped: ${text.textContent}`);
      }
    }
    const buttons = Array.from(node.querySelectorAll('button'));
    buttons.forEach((button, index) => {
      const rect = button.getBoundingClientRect();
      if (
        rect.left < box.left - 0.5 ||
        rect.right > box.right + 0.5 ||
        rect.top < box.top - 0.5 ||
        rect.bottom > box.bottom + 0.5
      ) {
        found.push(`button leaves the card: ${button.textContent}`);
      }
      for (const other of buttons.slice(index + 1)) {
        if (overlap(rect, other.getBoundingClientRect())) {
          found.push(
            `buttons overlap: ${button.textContent} and ${other.textContent}`,
          );
        }
      }
      const hit = root.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      if (hit === null || !button.contains(hit)) {
        found.push(
          `button is covered: ${button.textContent} by ${hit?.outerHTML.slice(0, 160) ?? 'nothing'}`,
        );
      }
    });
    // Nothing lies over the card: a press anywhere on it lands on the card itself.
    for (const fx of [0.1, 0.5, 0.9]) {
      for (const fy of [0.1, 0.5, 0.9]) {
        const hit = root.elementFromPoint(
          box.left + box.width * fx,
          box.top + box.height * fy,
        );
        if (hit === null || !node.contains(hit)) {
          found.push(
            `card is covered at ${String(fx)}, ${String(fy)} by ${hit?.outerHTML.slice(0, 120) ?? 'nothing'}`,
          );
        }
      }
    }
    return { faults: found };
  });
  expect(faults, label).toEqual([]);
}

/**
 * Walks the tour from its first step with Next, checking each step's title, its count
 * and its layout, and returns once the last step shows. The optional visit runs on each
 * step after the guard, such as a screenshot.
 */
export async function walkTour(
  page: Page,
  language: TourLanguage,
  steps: readonly TourStepName[],
  visit?: (step: TourStepName, index: number) => Promise<void>,
): Promise<void> {
  const copy = TOUR[language];
  const card = tourCard(page);
  for (const [index, step] of steps.entries()) {
    if (index > 0) {
      await card.getByRole('button', { name: copy.next, exact: true }).click();
    }
    await expect(card.getByRole('heading')).toHaveText(copy.titles[step]);
    await expect(card).toContainText(copy.count(index + 1, steps.length));
    // The spotlight glides for 200 ms; the guard measures where it rests.
    await page.waitForTimeout(300);
    await expectTourStepLaidOut(page, `${language} ${step}`);
    await visit?.(step, index);
  }
  await expect(
    card.getByRole('button', { name: copy.finish, exact: true }),
  ).toBeVisible();
}
