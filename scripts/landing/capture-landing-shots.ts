// Captures the landing page screenshots from the real extension (ADR-0066). Every shot
// runs the debug build against the e2e host replica and its fixture data, so the
// images show real Thai course data rendered by the product itself. Each state is
// built once per language in a fresh profile whose panel language is seeded first, so
// plan names and labels read naturally in both. The masters land in
// test-results/landing-masters, which is not committed; scripts/landing/encode-shots.mjs
// turns them into the committed site images.

import type { BrowserContext, Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  test,
  expect,
  catalogAtRest,
  expandCourse,
  gotoSelector,
  waitForResultsInput,
  waitForTermSettled,
} from '../../tests/e2e/support/fixtures';
import { waitForInstallTab } from '../../tests/e2e/support/onboarding';
import { extensionWorker } from '../../tests/e2e/support/worker';
import type thDict from '../../src/lib/i18n/th.json';
import {
  ONBOARDING_KEY,
  PREFS_KEY,
  ROOT_KEY,
} from '../../src/lib/storage/keys';

type Locale = 'th' | 'en';
type Key = keyof typeof thDict;

const LOCALES: readonly Locale[] = ['th', 'en'];
const MASTER_DIR = resolve(process.cwd(), 'test-results/landing-masters');

function readDict(locale: Locale): Record<Key, string> {
  // The product's own dictionaries, read at runtime because the test runner loads
  // JSON modules only with an import attribute.
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `src/lib/i18n/${locale}.json`), 'utf8'),
  ) as Record<Key, string>;
}

const DICTS: Record<Locale, Record<Key, string>> = {
  th: readDict('th'),
  en: readDict('en'),
};

function tr(locale: Locale, key: Key): string {
  return DICTS[locale][key];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The launcher names itself in either language until the seeded preference loads.
const LAUNCHER = new RegExp(
  `^(?:${LOCALES.map((locale) => escapeRegExp(tr(locale, 'launcher.open'))).join('|')})$`,
);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The worker exposes the extension API as a global; the capture describes only the
// part it calls.
interface WorkerGlobals {
  chrome: {
    storage: {
      local: {
        get(key: string): Promise<Record<string, unknown>>;
        set(items: Record<string, unknown>): Promise<void>;
      };
      session: { clear(): Promise<void> };
    };
  };
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (found === null) {
    throw new Error('A capture target has no layout box.');
  }
  return found;
}

function union(...boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** Grow a box by a margin, kept inside the viewport. */
function pad(page: Page, area: Box, margin: number): Box {
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  const x = Math.max(0, area.x - margin);
  const y = Math.max(0, area.y - margin);
  const right = Math.min(viewport.width, area.x + area.width + margin);
  const bottom = Math.min(viewport.height, area.y + area.height + margin);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Hide the debug only diagnostics control. The debug build is the only one whose
 * shadow root locators can reach, and this control is its one visible difference.
 */
async function hideDebugControls(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const root = el.shadowRoot;
      if (root?.querySelector('style[data-landing]') !== null) {
        continue;
      }
      const style = document.createElement('style');
      style.dataset.landing = '';
      style.textContent = 'button[aria-label^="Diagnostics"]{display:none}';
      root.append(style);
    }
  });
}

/** Let a fold, a sheet or a dialog finish its entrance before a shot. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(700);
}

/** Save one master, the whole viewport or a clip of it. */
async function shot(
  page: Page,
  id: string,
  locale: Locale,
  clip?: Box,
): Promise<void> {
  await hideDebugControls(page);
  await settle(page);
  await page.screenshot({
    path: resolve(MASTER_DIR, `${id}-${locale}.png`),
    animations: 'disabled',
    caret: 'hide',
    ...(clip !== undefined ? { clip } : {}),
  });
}

async function storageSet(
  context: BrowserContext,
  items: Record<string, unknown>,
): Promise<void> {
  const service = await extensionWorker(context);
  await service.evaluate(async (values) => {
    // Capture only assertion: an extension worker carries the global described above.
    const globals = globalThis as unknown as WorkerGlobals;
    await globals.chrome.storage.local.set(values);
  }, items);
}

/** Seed the panel language before the first page loads, as a saved preference. */
async function seedLanguage(
  context: BrowserContext,
  locale: Locale,
): Promise<void> {
  await storageSet(context, {
    [PREFS_KEY]: { schemaVersion: 1, language: locale },
  });
}

async function openIn(context: BrowserContext, locale: Locale): Promise<Page> {
  await seedLanguage(context, locale);
  const page = await gotoSelector(context);
  await page.getByRole('button', { name: LAUNCHER }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  return page;
}

/** Choose a combobox option by typing a filter and confirming the first match. */
async function pick(page: Page, name: string, filter: string): Promise<void> {
  const combo = page.getByRole('combobox', { name });
  await combo.click();
  await combo.fill(filter);
  await combo.press('Enter');
}

async function submit(page: Page, locale: Locale): Promise<void> {
  await waitForTermSettled(page);
  await page
    .getByRole('button', { name: tr(locale, 'search.submit'), exact: true })
    .click();
}

/** Every fixture is semester 1/2569, while the form defaults to the next term. */
async function pickTerm(page: Page, locale: Locale): Promise<void> {
  await waitForTermSettled(page);
  await pick(page, tr(locale, 'search.year'), '2569');
  await pick(page, tr(locale, 'search.semester'), '1');
}

/** The by class search the hero plan comes from: cybersecurity, year 1. */
async function curriculumSearch(page: Page, locale: Locale): Promise<void> {
  await pickTerm(page, locale);
  await pick(page, tr(locale, 'search.faculty'), '01');
  await pick(page, tr(locale, 'search.department'), '05');
  await pick(
    page,
    tr(locale, 'search.curriculum'),
    locale === 'th' ? 'ความปลอดภัยไซเบอร์' : 'Cyber',
  );
  await pick(page, tr(locale, 'search.classYear'), '1');
  await submit(page, locale);
  await expect(page.getByText('01006020').first()).toBeVisible({
    timeout: 15_000,
  });
  await waitForResultsInput(page);
}

function addButton(
  page: Page,
  locale: Locale,
  subjectId: string,
  section: string,
): Locator {
  return page.getByRole('button', {
    name: `${tr(locale, 'action.add')} ${subjectId} ${tr(locale, 'section.code')} ${section}`,
    exact: true,
  });
}

async function addSection(
  page: Page,
  locale: Locale,
  subjectId: string,
  section: string,
): Promise<void> {
  await expandCourse(page, subjectId);
  await addButton(page, locale, subjectId, section).click();
  await catalogAtRest(page);
}

/** Plan H: seven subjects of the cybersecurity curriculum, year 1, 19 credits. */
const PLAN_H: readonly (readonly [string, string])[] = [
  ['01476101', '33'],
  ['04186098', '1'],
  ['01006020', '4'],
  ['01006503', '1'],
  ['01006021', '5'],
  ['01006030', '33'],
  ['01476012', '33'],
];

/**
 * A new plan takes the Thai default name in either language, so the English shots
 * rename it through the plan menu, as a student reading the panel in English would.
 */
async function nameInEnglish(page: Page, locale: Locale): Promise<void> {
  if (locale !== 'en') return;
  await page
    .getByRole('button', { name: tr(locale, 'planSwitcher.label') })
    .click();
  await page
    .getByRole('button', {
      name: `${tr(locale, 'planSwitcher.rename')} ${tr('th', 'plan.untitled')} 1/2569`,
    })
    .click();
  await page
    .getByRole('textbox', { name: tr(locale, 'planSwitcher.nameLabel') })
    .fill('Plan 1/2569');
  await page
    .getByRole('button', { name: tr(locale, 'planSwitcher.save'), exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: tr(locale, 'planSwitcher.save') }),
  ).toHaveCount(0);
  if (
    await page
      .getByRole('button', { name: tr(locale, 'planSwitcher.create') })
      .isVisible()
  ) {
    await page.keyboard.press('Escape');
  }
}

async function buildPlan(
  page: Page,
  locale: Locale,
  skip?: string,
): Promise<void> {
  await curriculumSearch(page, locale);
  for (const [subjectId, section] of PLAN_H) {
    if (subjectId !== skip) {
      await addSection(page, locale, subjectId, section);
    }
  }
  await nameInEnglish(page, locale);
}

function catalogColumn(page: Page): Locator {
  return page.locator('#kcp-catalog-column');
}

function statsBar(page: Page, locale: Locale): Locator {
  return page.getByRole('group', {
    name: tr(locale, 'stats.region'),
    exact: true,
  });
}

function gridGroup(page: Page, locale: Locale): Locator {
  return page.getByRole('group', { name: tr(locale, 'grid.label') });
}

function gridBlock(page: Page, subjectId: string): Locator {
  return page.locator('[data-teach-table-id]').filter({ hasText: subjectId });
}

async function restPointer(page: Page): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  await page.mouse.move(viewport.width - 10, viewport.height - 10);
}

async function saveDownload(
  page: Page,
  locale: Locale,
  id: string,
): Promise<void> {
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: tr(locale, 'preview.downloadPng') })
    .click();
  const download = await downloadPromise;
  await download.saveAs(resolve(MASTER_DIR, `${id}-${locale}.png`));
}

function sectionRow(page: Page, subjectId: string, section: string): Locator {
  return page
    .getByRole('article')
    .filter({ hasText: subjectId })
    .first()
    .locator('[data-drag-surface="section"]')
    .filter({ hasText: new RegExp(`(กลุ่มเรียน|Section) ${section}(?!\\d)`) });
}

/**
 * Write an older time into the saved snapshot of Calculus 1, section 33, so the next
 * check reconciles it against the fixture through the real revalidation path. This is
 * the one staged state on the page.
 */
async function moveCalculusSnapshot(context: BrowserContext): Promise<void> {
  const service = await extensionWorker(context);
  await service.evaluate(async (rootKey) => {
    // Capture only assertion: an extension worker carries the global described above.
    const globals = globalThis as unknown as WorkerGlobals;
    const items = await globals.chrome.storage.local.get(rootKey);
    const root = items[rootKey];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      const meetings = record.meetings;
      if (
        record.subjectId === '01006030' &&
        record.section === '33' &&
        Array.isArray(meetings)
      ) {
        const first = meetings[0] as Record<string, unknown> | undefined;
        if (first !== undefined) {
          first.startMin = 780;
          first.endMin = 960;
        }
      }
      Object.values(record).forEach(visit);
    };
    visit(root);
    await globals.chrome.storage.local.set({ [rootKey]: root });
  }, ROOT_KEY);
}

test.beforeAll(async () => {
  await mkdir(MASTER_DIR, { recursive: true });
});

for (const locale of LOCALES) {
  test(`hero ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    await buildPlan(page, locale);
    await expandCourse(page, '01006030');
    await restPointer(page);
    await expect(statsBar(page, locale)).toBeVisible();
    await shot(page, 's-hero', locale);
    const grid = await box(gridGroup(page, locale));
    const stats = await box(statsBar(page, locale));
    await shot(page, 's-hero-crop', locale, pad(page, union(grid, stats), 12));
  });

  test(`search form ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    await buildPlan(page, locale);
    await expandCourse(page, '01006030');
    await page
      .getByRole('button', { name: tr(locale, 'search.bar.edit') })
      .click();
    await catalogAtRest(page);
    await restPointer(page);
    const column = await box(catalogColumn(page));
    await shot(page, 's-search-form', locale, {
      ...column,
      height: Math.min(column.height, 820),
    });
  });

  test(`exports ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    await buildPlan(page, locale);
    await page
      .getByRole('button', { name: tr(locale, 'mode.preview'), exact: true })
      .click();
    await page
      .getByRole('radio', { name: tr(locale, 'preview.template.share') })
      .click();
    await settle(page);
    await saveDownload(page, locale, 'x-share169');
    await page
      .getByRole('radio', {
        name: tr(locale, 'preview.template.phonePortrait'),
      })
      .click();
    await page
      .getByRole('button', { name: tr(locale, 'preview.displayOptions') })
      .click();
    await page
      .getByRole('switch', { name: tr(locale, 'preview.showExams') })
      .click();
    await page.keyboard.press('Escape');
    await settle(page);
    await saveDownload(page, locale, 'x-phone-portrait');
  });

  test(`drag blocked and alternatives ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    await buildPlan(page, locale, '01006021');
    await expandCourse(page, '01006021');

    const from = await box(sectionRow(page, '01006021', '3'));
    const target = await box(gridBlock(page, '01006020'));
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 24, from.y + 24, {
      steps: 6,
    });
    // Rest the pointer in the lower right of the Tuesday block, so the grab card and
    // its reason chip leave the swap label readable.
    await page.mouse.move(
      target.x + target.width * 0.62,
      target.y + target.height * 0.58,
      { steps: 20 },
    );
    const grid = await box(gridGroup(page, locale));
    const area = union(grid, await box(statsBar(page, locale)));
    await shot(page, 's-drag-blocked', locale, pad(page, area, 12));
    // Release away from every drop target, so the blocked drag commits nothing.
    await page.mouse.move(grid.x + 40, 20, { steps: 10 });
    await page.mouse.up();
    await settle(page);
    await page.waitForTimeout(6500);

    await addButton(page, locale, '01006021', '3').click();
    const strip = page
      .locator('[aria-live="polite"]')
      .filter({ has: page.getByRole('button') });
    await expect(strip).toBeVisible();
    await strip.hover();
    const tabs = await box(
      page.getByRole('tablist', { name: tr(locale, 'planView.label') }),
    );
    const tuesday = await box(gridBlock(page, '01006020'));
    await shot(
      page,
      's-feedback-alternatives',
      locale,
      pad(
        page,
        {
          x: grid.x,
          y: tabs.y,
          width: grid.width,
          height: tuesday.y + tuesday.height - tabs.y,
        },
        12,
      ),
    );
  });

  test(`exam row ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    // Without the Monday programming class, Digital System Fundamentals meets clear of
    // the plan, so its card shows the exam clash alone.
    await buildPlan(page, locale, '01476101');
    await page
      .getByRole('button', { name: tr(locale, 'search.bar.edit') })
      .click();
    await page
      .getByRole('tab', {
        name: tr(locale, 'search.tab.bySubjectId'),
        exact: true,
      })
      .click();
    await page
      .getByRole('textbox', { name: tr(locale, 'search.subjectId') })
      .fill('90000700');
    await submit(page, locale);
    await expect(page.getByText('01076112').first()).toBeVisible({
      timeout: 15_000,
    });
    await waitForResultsInput(page);
    await page
      .getByRole('searchbox', { name: tr(locale, 'catalog.filter.fieldLabel') })
      .fill('01076112');
    await settle(page);
    await expandCourse(page, '01076112');
    await restPointer(page);
    const card = page
      .getByRole('article')
      .filter({ hasText: '01076112' })
      .first();
    await card.scrollIntoViewIfNeeded();
    await shot(page, 's-exam-row', locale, pad(page, await box(card), 8));
  });

  test(`updates dialog ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    await buildPlan(page, locale);
    await expect(
      statsBar(page, locale).getByText(
        locale === 'th' ? /ตรวจสอบแล้ว/ : /Checked/,
      ),
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await moveCalculusSnapshot(context);
    await page.reload();
    await page
      .getByRole('button', { name: tr(locale, 'launcher.open') })
      .click();
    const dialog = page.getByRole('dialog', {
      name: tr(locale, 'updates.title'),
    });
    await settle(page);
    if (!(await dialog.isVisible())) {
      await statsBar(page, locale)
        .getByRole('button', { name: tr(locale, 'revalidation.checkAgain') })
        .click({ timeout: 20_000 });
    }
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await restPointer(page);
    await shot(page, 's-updates', locale, pad(page, await box(dialog), 48));
  });

  test(`suggest and plan menu ${locale}`, async ({ context }) => {
    const page = await openIn(context, locale);
    await curriculumSearch(page, locale);
    await addSection(page, locale, '04186098', '1');
    await nameInEnglish(page, locale);
    await page
      .getByRole('button', { name: tr(locale, 'suggest.open') })
      .click();
    const dialog = page.getByRole('dialog', {
      name: tr(locale, 'suggest.title'),
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: tr(locale, 'suggest.pref.morning') })
      .click();
    const apply = dialog.getByRole('button', {
      name: tr(locale, 'suggest.apply'),
    });
    await expect(apply).toHaveCount(3);
    await restPointer(page);
    await shot(page, 's-suggest', locale, await box(dialog));

    await apply.first().click();
    await expect(dialog).toHaveCount(0);
    // Let the undo toast of the apply time out, so the menu shot carries no toast.
    await page.waitForTimeout(11_000);
    const switcher = page.getByRole('button', {
      name: tr(locale, 'planSwitcher.label'),
    });
    await switcher.click();
    const menu = page
      .getByRole('button', { name: tr(locale, 'planSwitcher.create') })
      .locator('xpath=ancestor::div[@style][1]');
    await expect(menu).toBeVisible();
    await restPointer(page);
    await shot(
      page,
      's-plan-menu',
      locale,
      pad(page, union(await box(switcher), await box(menu)), 16),
    );
  });
}

test.describe('tall desktop', () => {
  test.use({ viewport: { width: 1440, height: 1240 } });

  for (const locale of LOCALES) {
    test(`dedupe catalog ${locale}`, async ({ context }) => {
      const page = await openIn(context, locale);
      await pickTerm(page, locale);
      await page
        .getByRole('tab', {
          name: tr(locale, 'search.tab.byCategory'),
          exact: true,
        })
        .click();
      await pick(page, tr(locale, 'search.faculty'), '01');
      await pick(page, tr(locale, 'search.subjectOwner'), '90592xxx');
      await submit(page, locale);
      await expect(page.getByText('90592033').first()).toBeVisible({
        timeout: 15_000,
      });
      await waitForResultsInput(page);
      await expandCourse(page, '90592008');
      await expandCourse(page, '90592033');
      await page.locator('[data-catalog-scroller]').evaluate((node) => {
        node.scrollTop = 0;
      });
      await restPointer(page);
      await settle(page);
      const column = await box(catalogColumn(page));
      const last = await box(
        page.getByRole('article').filter({ hasText: '90592033' }).first(),
      );
      await shot(page, 's-catalog-dedupe', locale, {
        ...column,
        height: Math.min(column.height, last.y + last.height + 16 - column.y),
      });
    });
  }
});

// The Summary view runs longer than a desktop screen, so it is captured in a tall window
// narrow enough that the plan column keeps a readable measure beside the catalog.
test.describe('tall plan column', () => {
  test.use({ viewport: { width: 1024, height: 2300 } });

  for (const locale of LOCALES) {
    test(`summary ${locale}`, async ({ context }) => {
      const page = await openIn(context, locale);
      await buildPlan(page, locale);
      await page
        .getByRole('tab', {
          name: tr(locale, 'planView.summary'),
          exact: true,
        })
        .click();
      await restPointer(page);
      const tabpanel = page.getByRole('tabpanel');
      const panel = await box(tabpanel);
      // The panel fills the window; crop at the bottom of its last line of content.
      const bottom = await tabpanel.evaluate((node) =>
        Math.max(
          ...[...node.querySelectorAll('*')].map(
            (child) => child.getBoundingClientRect().bottom,
          ),
        ),
      );
      await shot(
        page,
        's-summary',
        locale,
        pad(page, { ...panel, height: bottom - panel.y }, 16),
      );
    });
  }
});

test.describe('first run', () => {
  test.use({ onboarding: 'fresh' });

  for (const locale of LOCALES) {
    test(`welcome ${locale}`, async ({ context }) => {
      const tab = await waitForInstallTab(context);
      if (locale === 'en') {
        // The welcome follows the panel language. Seed English, clear the record of
        // the welcome just shown in Thai and the worker's session grant, and reload.
        const service = await extensionWorker(context);
        await service.evaluate(async () => {
          // Capture only assertion: an extension worker carries the global described above.
          const globals = globalThis as unknown as WorkerGlobals;
          await globals.chrome.storage.session.clear();
        });
        await storageSet(context, {
          [PREFS_KEY]: { schemaVersion: 1, language: 'en' },
          [ONBOARDING_KEY]: { schemaVersion: 1 },
        });
        await tab.reload();
      }
      await tab.emulateMedia({ reducedMotion: 'reduce' });
      const dialog = tab.getByRole('dialog', {
        name: tr(locale, 'welcome.title'),
      });
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await shot(tab, 's-welcome', locale, pad(tab, await box(dialog), 64));
    });
  }
});

test.describe('narrow window', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  for (const locale of LOCALES) {
    test(`narrow shots ${locale}`, async ({ context }) => {
      const page = await openIn(context, locale);
      const nav = page.getByRole('navigation', {
        name: tr(locale, 'nav.label'),
      });
      const courses = nav.getByRole('button', { name: /^(รายวิชา|Courses)/ });
      await courses.click();
      await buildPlan(page, locale);
      await expandCourse(page, '01006030');
      await courses.click();
      // Let the confirmation of the last add time out, so the shot carries no toast.
      await page.waitForTimeout(9000);
      await shot(page, 'n-catalog', locale);

      await nav
        .getByRole('button', { name: tr(locale, 'planView.timetable') })
        .click();
      await page
        .getByRole('radiogroup', { name: tr(locale, 'view.dayPicker') })
        .getByRole('radio', { name: /^(วันอังคาร|Tuesday)/ })
        .click();
      await shot(page, 'n-day', locale);

      await gridBlock(page, '01006020').first().click();
      await shot(page, 'n-sheet', locale);
    });
  }
});

const OG_LINES: Record<Locale, string> = {
  th: 'เห็นตารางเรียนทั้งสัปดาห์<br>ก่อนลงทะเบียนจริง',
  en: 'See your whole week<br>before you register.',
};

function base64(path: string): string {
  return readFileSync(path).toString('base64');
}

/**
 * The open graph card, rendered from a self contained page: the KCP mark, the name and
 * one line on the left, and the real exported Share 16:9 poster bleeding off the right
 * and bottom edges. Runs last, after the exports tests have saved the posters.
 */
function ogPage(locale: Locale): string {
  const font = base64(
    resolve(process.cwd(), 'site/assets/fonts/kcp-display.woff2'),
  );
  const poster = base64(resolve(MASTER_DIR, `x-share169-${locale}.png`));
  const icon = base64(resolve(process.cwd(), 'assets/icon.svg'));
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
@font-face{font-family:'KCP Display';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:600}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#fff;color:#1a1a1a}
body{position:relative;font-family:'KCP Display','Leelawadee UI',sans-serif;font-weight:600}
.text{position:absolute;left:72px;top:96px;width:400px}
.mark{display:block;width:72px;height:72px}
h1{margin:40px 0 0;font-size:40px;line-height:52px;font-weight:600;letter-spacing:-0.01em}
p{margin:20px 0 0;font-size:28px;line-height:42px;color:#5c5c5c}
.poster{position:absolute;left:510px;top:150px;width:920px;border:1px solid #e4e4e7;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.10)}
</style></head><body>
<div class="text"><img class="mark" alt="" src="data:image/svg+xml;base64,${icon}"><h1>KCP: Course Planner for KMITL</h1><p>${OG_LINES[locale]}</p></div>
<img class="poster" alt="" src="data:image/png;base64,${poster}">
</body></html>`;
}

test.describe('open graph', () => {
  test.use({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

  for (const locale of LOCALES) {
    test(`og ${locale}`, async ({ context }) => {
      const page = await context.newPage();
      await page.setContent(ogPage(locale));
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.screenshot({
        path: resolve(MASTER_DIR, `og-${locale}.png`),
        clip: { x: 0, y: 0, width: 1200, height: 630 },
      });
    });
  }
});
