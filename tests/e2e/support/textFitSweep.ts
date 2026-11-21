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
import { SEARCH_FORM_ID } from '../../../src/features/search/searchIds';
import {
  expect,
  catalogAtRest,
  gotoSelector,
  SELECTOR_URL,
  waitForResultsInput,
  waitForTermSettled,
} from './fixtures';
import { brokenBlockNames } from './blockNames';
import { seedStorage } from './onboarding';
import { extensionWorker } from './worker';
import {
  scanTextFit,
  type TextFitException,
  type TextFitFinding,
  type TextFitScanOptions,
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

interface Recorded extends Omit<TextFitFinding, 'kind'> {
  /** A text fit fault, or a block name broken inside a word or one grapheme to a line. */
  kind: TextFitFinding['kind'] | 'broken name';
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

/** What the sweep reads of the open search form and its action row. */
interface SearchFormRead {
  /** How far the form scroller can scroll. */
  overflow: number;
  /** Whether the action row is pinned to the scroller foot. */
  pinned: boolean;
  /** The text of a control that follows the pinned row, or null. */
  trailing: string | null;
  /** Whether the scroller cuts the pinned row. */
  rowCut: boolean;
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
   * scrolled or set aside. A region behind a layer the student opened is scanned behind it,
   * where the layer may cover a line whole but its edge may not cut one.
   */
  async scan(
    surface: string,
    region: Locator,
    {
      floating = false,
      ...options
    }: { floating?: boolean } & TextFitScanOptions = {},
  ): Promise<void> {
    const target = region.first();
    await expect(target, surface).toBeVisible();
    await settle(this.page);
    const found = await scanTextFit(target, this.exceptions, options);
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

  /** Read the block names of every timetable grid in a region with the block name guard, so
   * a name broken inside a word fails the sweep in either language at every width. */
  async checkBlockNames(surface: string, region: Locator): Promise<void> {
    const grids = region.getByRole('group', {
      name: this.t('grid.label'),
      includeHidden: true,
    });
    for (const grid of await grids.all()) {
      for (const text of await brokenBlockNames(grid)) {
        this.findings.push({
          kind: 'broken name',
          text,
          surface,
          width: this.width,
        });
      }
    }
  }

  /**
   * Check that the open search form shows whole: at the sweep height its scroller holds
   * every field and the submit row without scrolling, since a scroller that caps the form
   * cuts a field through its box, which the text scan reads as scrolled rather than cut.
   * Its pinned action row, if any, is checked too, as expectPinnedRowLast does.
   */
  async expectSearchFormWhole(surface: string): Promise<void> {
    const read = await this.readSearchForm(surface);
    if (read.overflow > 1) {
      this.fault(
        surface,
        `the search form scrolls ${String(read.overflow)} px`,
      );
    }
    this.checkPinnedRow(surface, read);
  }

  /**
   * Check the pinned action row of a phone search form, which scrolls its fields under
   * the row by design: the row shows whole and nothing follows it, since a control after
   * it rests half cut at the scroller foot with no sign that the form scrolls.
   */
  async expectPinnedRowLast(surface: string): Promise<void> {
    const read = await this.readSearchForm(surface);
    if (!read.pinned) this.fault(surface, 'the action row is not pinned');
    this.checkPinnedRow(surface, read);
  }

  private fault(surface: string, text: string): void {
    this.findings.push({ kind: 'clipped', text, surface, width: this.width });
  }

  private checkPinnedRow(surface: string, read: SearchFormRead): void {
    if (read.trailing !== null) {
      this.fault(
        surface,
        `"${read.trailing}" rests after the pinned action row`,
      );
    }
    if (read.rowCut) {
      this.fault(surface, 'the pinned action row is cut by the form scroller');
    }
  }

  private async readSearchForm(surface: string): Promise<SearchFormRead> {
    await settle(this.page);
    const read = await this.page.evaluate((id) => {
      const root = document.querySelector('kcp-planner-root')?.shadowRoot;
      const scroller = root?.getElementById(id)?.firstElementChild;
      if (scroller === null || scroller === undefined) return null;
      const pinned = [...scroller.querySelectorAll('*')].find(
        (element) => getComputedStyle(element).position === 'sticky',
      );
      let trailing: string | null = null;
      for (
        let element: Element | null = pinned ?? null;
        element !== null && element !== scroller;
        element = element.parentElement
      ) {
        for (
          let next = element.nextElementSibling;
          next !== null && trailing === null;
          next = next.nextElementSibling
        ) {
          const box = next.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) {
            trailing = next.textContent.replace(/\s+/g, ' ').trim();
          }
        }
      }
      const frame = scroller.getBoundingClientRect();
      const row = pinned?.getBoundingClientRect();
      return {
        overflow: scroller.scrollHeight - scroller.clientHeight,
        pinned: pinned !== undefined,
        trailing,
        rowCut:
          row !== undefined &&
          (row.top < frame.top - 1 || row.bottom > frame.bottom + 1),
      };
    }, SEARCH_FORM_ID);
    if (read === null) {
      throw new Error(`${surface}: no search form is on show`);
    }
    return read;
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

// The extension storage the worker exposes as a global; the sweep describes only the part
// it calls.
interface StorageGlobals {
  chrome: {
    storage: {
      local: {
        QUOTA_BYTES: number;
        getBytesInUse(keys: null): Promise<number>;
        get(key: string): Promise<Record<string, unknown>>;
        set(items: Record<string, unknown>): Promise<void>;
        remove(key: string): Promise<void>;
      };
    };
  };
}

const FILLER_KEY = 'e2e:filler';

/** Fill extension storage to within a few bytes of its quota, so the next plan save fails. */
export async function fillStorage(context: BrowserContext): Promise<void> {
  const worker = await extensionWorker(context);
  await worker.evaluate(async (key) => {
    // Test only assertion: an extension worker carries the chrome global.
    const { local } = (globalThis as unknown as StorageGlobals).chrome.storage;
    const room = local.QUOTA_BYTES - (await local.getBytesInUse(null));
    await local.set({ [key]: 'x'.repeat(room - 32) });
  }, FILLER_KEY);
}

/** Give the storage its room back, so saves land again. */
export async function emptyStorage(context: BrowserContext): Promise<void> {
  const worker = await extensionWorker(context);
  await worker.evaluate(async (key) => {
    // Test only assertion: an extension worker carries the chrome global.
    await (globalThis as unknown as StorageGlobals).chrome.storage.local.remove(
      key,
    );
  }, FILLER_KEY);
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
    const { local } = (globalThis as unknown as StorageGlobals).chrome.storage;
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
