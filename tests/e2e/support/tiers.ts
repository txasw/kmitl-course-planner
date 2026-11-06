// The layout tiers of ADR-0048 as the specs that run across them see them: the
// viewports each tier is scanned at, which tier a page lays out at, and how the
// catalog and the timetable are brought into view at each. The catalog docks beside
// the grid from 1024 px, opens as a modal sheet from 640 px, and below that shares
// the body with the timetable one pane at a time behind a bottom nav. The helpers
// press with a click, so they serve the fine pointer debug project; the touch
// projects tap through their own helpers.

import type { Locator, Page } from '@playwright/test';
import { BREAKPOINTS } from '../../../src/lib/ui/breakpoints';

export type TierKind = 'docked' | 'sheet' | 'pane';

export interface Tier {
  name: string;
  kind: TierKind;
  viewport: { width: number; height: number };
}

/** One viewport per tier kind, plus the narrowest docked width. */
export const TIERS: readonly Tier[] = [
  { name: 'desktop', kind: 'docked', viewport: { width: 1440, height: 900 } },
  {
    name: 'small desktop',
    kind: 'docked',
    viewport: { width: 1024, height: 768 },
  },
  { name: 'tablet', kind: 'sheet', viewport: { width: 768, height: 1024 } },
  { name: 'phone', kind: 'pane', viewport: { width: 390, height: 844 } },
];

/** The tier kind the page lays out at, read from its viewport width. */
export function tierKind(page: Page): TierKind {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= BREAKPOINTS.lg) return 'docked';
  if (width >= BREAKPOINTS.sm) return 'sheet';
  return 'pane';
}

export function bottomNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'ส่วนของตัววางแผน' });
}

export const CATALOG_COLUMN = '#kcp-catalog-column';

/**
 * Bring the catalog into view by clicking, and return the container that holds the
 * search and the results: the docked column, the sheet, or the catalog pane.
 */
export async function showCatalogByClick(page: Page): Promise<Locator> {
  const kind = tierKind(page);
  if (kind === 'pane') {
    await bottomNav(page)
      .getByRole('button', { name: /^รายวิชา/ })
      .click();
  } else if (kind === 'sheet') {
    await page.getByRole('button', { name: /^รายวิชา/ }).click();
    return page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
  }
  return page.locator(CATALOG_COLUMN);
}

/**
 * Bring the timetable into view by clicking: the timetable pane on the phone, the
 * sheet closed on the tablet. The docked tiers show it beside the catalog already.
 */
export async function showTimetableByClick(page: Page): Promise<void> {
  const kind = tierKind(page);
  if (kind === 'pane') {
    await bottomNav(page).getByRole('button', { name: 'ตารางเรียน' }).click();
  } else if (kind === 'sheet') {
    await page
      .locator(CATALOG_COLUMN)
      .getByRole('button', { name: 'ปิดรายการรายวิชา' })
      .click();
  }
}
