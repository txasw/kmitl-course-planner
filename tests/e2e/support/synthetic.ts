// Shared helpers for the specs that drive the synthetic by subject id catalog. The
// mock server serves a controlled catalog for the reserved id 90000000 (Course A on
// Mon 09-11, Course B overlapping it, Course C with two non overlapping sections,
// Course E, and a Course X pair), so a spec can add, move, and revalidate known
// sections that the captured fixtures cannot express.

import {
  expect,
  catalogAtRest,
  expandCourse,
  waitForResultsInput,
  submitSearch,
} from './fixtures';
import type { Page } from '@playwright/test';

/** A placed grid block is addressed by its synthetic fixture teach_table_id. */
export function block(id: string): string {
  return `[data-teach-table-id="${id}"]`;
}

/** A reserved search id the mock server answers, and a subject id its result shows. */
export interface ReservedSearch {
  id: string;
  shows: string;
}

/** The synthetic catalog of the reserved id 90000000. */
export const SYNTHETIC_SEARCH: ReservedSearch = {
  id: '90000000',
  shows: '90000001',
};

/**
 * Run the by subject id search for a reserved id, the synthetic one unless another is
 * named, and wait for results.
 */
export async function syntheticSearch(
  page: Page,
  search: ReservedSearch = SYNTHETIC_SEARCH,
): Promise<void> {
  await page.getByRole('tab', { name: 'รหัสวิชา', exact: true }).click();
  await page.getByRole('textbox', { name: 'รหัสวิชา' }).fill(search.id);
  await submitSearch(page);
  await expect(page.getByText(search.shows).first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
}

/** Add the first section of a course by its subject id, opening its card first. */
export async function addCourse(page: Page, subjectId: string): Promise<void> {
  await expandCourse(page, subjectId);
  await page
    .getByRole('article')
    .filter({ hasText: subjectId })
    .first()
    .getByRole('button', { name: /^เพิ่ม/ })
    .first()
    .click();
  // An added card collapses, which moves every card below it.
  await catalogAtRest(page);
}
