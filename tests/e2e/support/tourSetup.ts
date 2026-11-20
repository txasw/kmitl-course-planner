// The panel states the product tour specs start from (ADR-0074). A full tour needs a
// curriculum search, which brings the query chip, the add buttons of an open course and
// the suggest action, so every step has its control; the tour is then opened from the
// overflow menu, as a student who wants to see it again would.

import type { Locator, Page } from '@playwright/test';
import {
  expect,
  expandCourse,
  pickOption,
  submitSearch,
  waitForResultsInput,
} from './fixtures';
import { tierKind } from './tiers';
import { TOUR, tourCard, type TourLanguage } from './tour';

/** The catalog container at the page's tier: the docked column, the sheet, or the pane. */
async function catalogContainer(page: Page): Promise<Locator> {
  if (tierKind(page) === 'sheet') {
    await page.getByRole('button', { name: /^รายวิชา/ }).click();
    return page.getByRole('dialog', { name: 'ค้นหารายวิชา' });
  }
  return page.locator('#kcp-catalog-column');
}

/** Runs the curriculum 137 search and opens its first course, so its sections show. */
export async function searchCurriculum(page: Page): Promise<void> {
  const catalog = await catalogContainer(page);
  await pickOption(page, 'คณะ', '01');
  await pickOption(page, 'ภาควิชา', '05');
  await pickOption(page, 'หลักสูตร', 'ความปลอดภัยไซเบอร์');
  await submitSearch(catalog);
  await expect(catalog.getByText('01006020').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
  await expandCourse(page, '01006020');
}

/** Opens the tour from the header overflow menu, in the language the panel shows. */
export async function openTourFromMenu(
  page: Page,
  language: TourLanguage,
): Promise<void> {
  const copy = TOUR[language];
  await page.getByRole('button', { name: copy.more }).click();
  await page.getByRole('menuitem', { name: copy.menu }).click();
  await expect(tourCard(page)).toBeVisible();
}

/** Switches the panel language from the overflow menu. */
export async function chooseLanguage(
  page: Page,
  from: TourLanguage,
  to: TourLanguage,
): Promise<void> {
  await page.getByRole('button', { name: TOUR[from].more }).click();
  await page
    .getByRole('menuitemradio', { name: to === 'th' ? 'ไทย' : 'English' })
    .click();
}
