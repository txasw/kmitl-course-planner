// The walk behind the clipped text sweep (ADR-0048 amendment): a Sweep reads each surface
// it is shown with the text fit scan and gathers every fault across the widths, so one run
// lists them all, and the helpers bring each surface into view at any layout tier in either
// language, naming every control by its product string. Two variables help a person read a
// run: TEXT_FIT_SHOT_DIR saves a screenshot of every surface scanned, and TEXT_FIT_WIDTHS
// narrows the widths, such as 360,1366, while a failure is chased.

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { PREFS_KEY, ROOT_KEY } from '../../../src/lib/storage/keys';
import { BREAKPOINTS } from '../../../src/lib/ui/breakpoints';
import {
  expect,
  catalogAtRest,
  gotoSelector,
  SELECTOR_URL,
  waitForResultsInput,
  waitForTermSettled,
} from './fixtures';
import { seedStorage } from './onboarding';
import { extensionWorker } from './worker';
import {
  scanTextFit,
  type TextFitException,
  type TextFitFinding,
} from './textFit';

export const WIDTHS = (process.env.TEXT_FIT_WIDTHS ?? '360,390,768,1366')
  .split(',')
  .map(Number);
export const HEIGHT = 800;
export const RESULTS_TIMEOUT = 15_000;

export type Language = 'th' | 'en';

/** A dictionary read off disk, so the spec names every control by its product key. */
function dictionary(language: Language): Record<string, string> {
  // Test only assertion: the dictionaries are flat string maps, which t() relies on too.
  return JSON.parse(
    readFileSync(join(process.cwd(), `src/lib/i18n/${language}.json`), 'utf8'),
  ) as Record<string, string>;
}

const DICTIONARIES: Record<Language, Record<string, string>> = {
  th: dictionary('th'),
  en: dictionary('en'),
};

interface Recorded extends TextFitFinding {
  surface: string;
  width: number;
}

/**
 * Wait until no short animation or transition in the panel's shadow root is running, so a
 * sheet that slides or a card that opens is read where it rests. A progress drain such as
 * the undo toast's runs for many seconds and is left to run.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('kcp-planner-root')?.shadowRoot;
      if (root === null || root === undefined) return true;
      return root.getAnimations().every((animation) => {
        if (animation.playState !== 'running') return true;
        const timing = animation.effect?.getComputedTiming();
        const end = Number(timing?.endTime ?? 0);
        return !Number.isFinite(end) || end > 2_000;
      });
    },
    undefined,
    { timeout: 5_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

export class Sweep {
  readonly findings: Recorded[] = [];
  private shots = 0;

  constructor(
    readonly page: Page,
    readonly language: Language,
    private readonly exceptions: readonly TextFitException[],
  ) {}

  /** The product string for a key in the sweep's language. */
  t(key: string): string {
    const value = DICTIONARIES[this.language][key];
    if (value === undefined) throw new Error(`No string for ${key}`);
    return value;
  }

  get width(): number {
    return this.page.viewportSize()?.width ?? 0;
  }

  get phone(): boolean {
    return this.width < BREAKPOINTS.sm;
  }

  get docked(): boolean {
    return this.width >= BREAKPOINTS.lg;
  }

  panel(): Locator {
    return this.page.getByRole('dialog', {
      name: this.t('app.title'),
      exact: true,
    });
  }

  /**
   * Scan a region. A floating surface that follows the pointer also has to sit wholly in
   * the viewport, since text pushed off the screen is skipped by the scan as text that is
   * scrolled or set aside.
   */
  async scan(
    surface: string,
    region: Locator,
    { floating = false }: { floating?: boolean } = {},
  ): Promise<void> {
    const target = region.first();
    await expect(target, surface).toBeVisible();
    await settle(this.page);
    const found = await scanTextFit(target, this.exceptions);
    for (const finding of found) {
      this.findings.push({ ...finding, surface, width: this.width });
    }
    const box = floating ? await target.boundingBox() : null;
    if (
      box !== null &&
      (box.x < 0 ||
        box.y < 0 ||
        box.x + box.width > this.width ||
        box.y + box.height > HEIGHT)
    ) {
      this.findings.push({
        kind: 'outside',
        text: (await target.innerText()).replace(/\s+/g, ' '),
        surface,
        width: this.width,
      });
    }
    const dir = process.env.TEXT_FIT_SHOT_DIR;
    if (dir !== undefined) {
      mkdirSync(dir, { recursive: true });
      this.shots += 1;
      const name = `${this.language}-${String(this.width)}-${String(this.shots).padStart(2, '0')}-${surface.replace(/[^a-z0-9]+/gi, '-')}.png`;
      // A screenshot of a busy machine can outlast the action timeout of the walk.
      await this.page.screenshot({ path: join(dir, name), timeout: 60_000 });
    }
  }

  /** Report every finding across the walk at once, so one run lists them all. */
  expectClean(): void {
    expect(
      this.findings.map(
        (finding) =>
          `${String(finding.width)} px ${finding.surface}: ${finding.kind} ${finding.text.slice(0, 90)}${finding.detail === undefined ? '' : ` (${finding.detail})`}`,
      ),
    ).toEqual([]);
  }
}

export async function openSweep(
  context: BrowserContext,
  language: Language,
  exceptions: readonly TextFitException[],
): Promise<Sweep> {
  await seedStorage(context, PREFS_KEY, { schemaVersion: 1, language });
  const page = await gotoSelector(context);
  return new Sweep(page, language, exceptions);
}

/**
 * Load the host page at a width and open the panel from the launcher. Given the context,
 * it starts from no saved plan: the page is left first, since an open page saves its plan
 * as it unloads and would write back a plan removed under it.
 */
export async function openAt(
  sweep: Sweep,
  width: number,
  fresh?: BrowserContext,
): Promise<void> {
  const { page } = sweep;
  await page.setViewportSize({ width, height: HEIGHT });
  if (fresh === undefined) {
    await page.reload();
  } else {
    await page.goto('about:blank');
    await clearPlans(fresh);
    await page.goto(SELECTOR_URL);
  }
  await page.getByRole('button', { name: sweep.t('launcher.open') }).click();
  await expect(sweep.panel()).toBeVisible();
  await settle(page);
}

/**
 * Bring the catalog into view and return the container that holds the search and the
 * results: the catalog pane on the phone, the sheet on the tablet, the docked column.
 */
export async function showCatalog(sweep: Sweep): Promise<Locator> {
  const { page } = sweep;
  const sheet = page.getByRole('dialog', {
    name: sweep.t('catalog.sheet.title'),
  });
  if (sweep.phone) {
    await page
      .getByRole('navigation', { name: sweep.t('nav.label') })
      .getByRole('button', { name: new RegExp(`^${sweep.t('catalog.open')}`) })
      .click();
  } else if (!sweep.docked && (await sheet.count()) === 0) {
    await sweep
      .panel()
      .getByRole('button', { name: new RegExp(`^${sweep.t('catalog.open')}`) })
      .first()
      .click();
  }
  await settle(page);
  return sweep.docked || sweep.phone
    ? page.locator('#kcp-catalog-column')
    : sheet;
}

/** Bring the timetable into view: the timetable pane on the phone, the sheet closed. */
export async function showTimetable(sweep: Sweep): Promise<void> {
  const { page } = sweep;
  if (sweep.phone) {
    await page
      .getByRole('navigation', { name: sweep.t('nav.label') })
      .getByRole('button', { name: sweep.t('planView.timetable') })
      .click();
  } else if (!sweep.docked) {
    const close = page
      .locator('#kcp-catalog-column')
      .getByRole('button', { name: sweep.t('catalog.sheet.close') });
    if ((await close.count()) > 0) await close.click();
  }
  await settle(page);
}

export async function searchSubjectId(
  sweep: Sweep,
  catalog: Locator,
  subjectId: string,
  expected: string,
): Promise<void> {
  const { page } = sweep;
  const edit = catalog.getByRole('button', {
    name: sweep.t('search.bar.edit'),
  });
  if ((await edit.count()) > 0) await edit.click();
  await catalog
    .getByRole('tab', { name: sweep.t('search.tab.bySubjectId'), exact: true })
    .click();
  await catalog
    .getByRole('textbox', { name: sweep.t('search.subjectId') })
    .fill(subjectId);
  await waitForTermSettled(catalog);
  await catalog
    .getByRole('button', { name: sweep.t('search.submit'), exact: true })
    .click();
  await expect(
    catalog.locator(`[data-course-card="${expected}"]`).first(),
  ).toBeVisible({ timeout: RESULTS_TIMEOUT });
  await waitForResultsInput(page);
  await restCatalog(page);
}

/**
 * Wait for the catalog to rest, failing at once when no catalog list is on show rather than
 * waiting on it until the test times out.
 */
async function restCatalog(page: Page): Promise<void> {
  await expect(page.locator('[data-catalog-scroller]')).toHaveCount(1);
  await catalogAtRest(page);
}

/** Open a collapsed course card so its section rows show. */
export async function expandCourse(
  sweep: Sweep,
  subjectId: string,
): Promise<Locator> {
  const card = sweep.page.locator(`[data-course-card="${subjectId}"]`).first();
  const toggle = card.locator('[data-course-toggle]');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await restCatalog(sweep.page);
  return card;
}

/** Add the first open section of a course from its card. */
export async function addCourse(
  sweep: Sweep,
  subjectId: string,
): Promise<void> {
  const card = await expandCourse(sweep, subjectId);
  await card
    .getByRole('button', { name: new RegExp(`^${sweep.t('action.add')}`) })
    .first()
    .click();
  await restCatalog(sweep.page);
}

export async function dismissToasts(sweep: Sweep): Promise<void> {
  const region = sweep.page.locator('[aria-live="polite"][aria-atomic="true"]');
  const close = region.getByRole('button', {
    name: sweep.t('action.dismiss'),
    exact: true,
  });
  while ((await close.count()) > 0) await close.first().click();
}

/**
 * Remove every saved plan, so each width starts from an empty plan list. The page just left
 * may still be writing the plan it saved as it unloaded, so the key is removed until it
 * stays away for a short quiet spell.
 */
async function clearPlans(context: BrowserContext): Promise<void> {
  const worker = await extensionWorker(context);
  await worker.evaluate(async (key) => {
    // Test only assertion: an extension worker carries the chrome global.
    const local = (
      globalThis as unknown as {
        chrome: {
          storage: {
            local: {
              get(key: string): Promise<Record<string, unknown>>;
              remove(key: string): Promise<void>;
            };
          };
        };
      }
    ).chrome.storage.local;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await local.remove(key);
      await new Promise((resolve) => setTimeout(resolve, 400));
      if ((await local.get(key))[key] === undefined) return;
    }
    throw new Error('The saved plans came back after every removal');
  }, ROOT_KEY);
}

/** Choose an option in a searchable combobox of the catalog by typing a filter. */
export async function pick(
  catalog: Locator,
  name: string,
  filter: string,
): Promise<void> {
  const combo = catalog.getByRole('combobox', { name });
  await combo.click();
  await combo.fill(filter);
  await combo.press('Enter');
}

/** The open block detail surface: the popover on the wide tiers, a sheet on the phone. */
export function blockDetail(sweep: Sweep): Locator {
  return sweep.page
    .getByRole('dialog')
    .filter({
      has: sweep.page.getByRole('button', {
        name: sweep.t('block.removeFromPlan'),
      }),
    })
    .last();
}

/** The undo toast, found by its undo action. */
export function undoToast(sweep: Sweep): Locator {
  return sweep.page
    .getByRole('button', { name: sweep.t('action.undo'), exact: true })
    .locator('..');
}
