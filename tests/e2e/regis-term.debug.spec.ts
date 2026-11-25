import type { Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { ROOT_KEY } from '../../src/lib/storage/keys';
import { test, expect, openPlanner } from './support/fixtures';
import { planWithKit } from './support/regisKit';
import type { Replica } from './host/pre_registration/replica.js';

declare global {
  interface Window {
    replica: Replica;
  }
}

// The helper follows the term the page registers, not the planner's active plan. A
// second, newer plan of another term, which a reload used to activate, must not hide the
// plan of the page's own term, and a page term with no plan offers to make one, which
// changes the active plan only on that press.

const SUBJECTS = ['90000001', '90000003'] as const;

interface Root {
  schemaVersion: number;
  plans: { id: string; year: string; semester: string; updatedAt: string }[];
  activePlanId?: string | null;
}
interface WorkerStorage {
  chrome: {
    storage: {
      local: {
        get(key: string): Promise<Record<string, Root>>;
        set(items: Record<string, unknown>): Promise<void>;
      };
    };
  };
}

async function openPage(page: Page, term: { year: string; semester: string }) {
  // The page shows the term from its first render, as the host fixes it at mount.
  await page.goto(
    `${REGIS_ORIGIN}/replica/pre_registration?term=${term.semester}/${term.year}#/pre_registration`,
  );
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate((next) => {
    window.replica.set({ term: next });
  }, term);
}

test('the helper shows the plan of the page term after a newer plan of another term', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const { term } = await planWithKit(page, serviceWorker, SUBJECTS);
  const other = term.semester === '3' ? '1' : String(Number(term.semester) + 1);
  // A newer, empty plan of another term, as if the student added it after this one.
  await serviceWorker.evaluate(
    async ({ root, semester }) => {
      const { local } = (globalThis as unknown as WorkerStorage).chrome.storage;
      const stored = (await local.get(root))[root];
      if (stored === undefined) throw new Error('no root');
      const first = stored.plans[0];
      if (first === undefined) throw new Error('no plan');
      // The newer plan is also the active one, as after the student switched to it.
      await local.set({
        [root]: {
          ...stored,
          activePlanId: '00000000-0000-4000-8000-000000000099',
          plans: [
            ...stored.plans,
            {
              ...first,
              id: '00000000-0000-4000-8000-000000000099',
              name: `ตาราง ${semester}/${first.year}`,
              semester,
              entries: [],
              updatedAt: new Date(Date.now() + 60_000).toISOString(),
            },
          ],
        },
      });
    },
    { root: ROOT_KEY, semester: other },
  );

  await openPage(page, term);
  const card = page.locator('#kcp-regis-card');
  await expect(card).toBeVisible();
  for (const id of SUBJECTS) {
    await expect(
      card.locator(`[data-status][aria-label^="${id}"]`).first(),
    ).toBeVisible();
  }
});

test('a page term with no plan offers to make one, on the press only', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const { term } = await planWithKit(page, serviceWorker, SUBJECTS);
  const next = { year: String(Number(term.year) + 1), semester: term.semester };

  await openPage(page, next);
  const card = page.locator('#kcp-regis-card');
  await expect(card).toContainText(
    `ยังไม่มีตารางของภาค ${next.semester}/${next.year}`,
  );
  const before = await serviceWorker.evaluate(async (root) => {
    const { local } = (globalThis as unknown as WorkerStorage).chrome.storage;
    return (await local.get(root))[root]?.plans.length ?? 0;
  }, ROOT_KEY);
  expect(before).toBe(1);

  await card
    .getByRole('button', { name: `สร้างตาราง ${next.semester}/${next.year}` })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.overflow))
    .toBe('hidden');
  // Autosave debounces at 300 ms.
  await expect
    .poll(
      () =>
        serviceWorker.evaluate(async (root) => {
          const { local } = (globalThis as unknown as WorkerStorage).chrome
            .storage;
          const stored = (await local.get(root))[root];
          const active = stored?.plans.find(
            (plan) => plan.id === stored.activePlanId,
          );
          return active === undefined
            ? null
            : { year: active.year, semester: active.semester };
        }, ROOT_KEY),
      { timeout: 5_000 },
    )
    .toEqual(next);
});

interface StoredEntry {
  sourceQuery: { params: Record<string, string> };
}
interface StoredPlanWithEntries {
  id: string;
  name: string;
  semester: string;
  entries: StoredEntry[];
}

/** What the helper and the page showed at one moment, read through the open root. */
interface Sample {
  loaded: boolean;
  chips: number;
  count: string | null;
  reading: boolean;
  launcher: string | null;
  entryToast: boolean;
}

/**
 * Make the active plan a newer one of another term with one subject, so its count, 0/1,
 * and its chip would show if the helper fell back to it before the term is read.
 */
async function addNewerPlanOfAnotherTerm(
  serviceWorker: Worker,
  term: { year: string; semester: string },
): Promise<void> {
  const other = term.semester === '3' ? '1' : String(Number(term.semester) + 1);
  await serviceWorker.evaluate(
    async ({ root, semester }) => {
      const { local } = (globalThis as unknown as WorkerStorage).chrome.storage;
      const stored = (await local.get(root))[root];
      if (stored === undefined) throw new Error('no root');
      const first = stored.plans[0] as unknown as
        StoredPlanWithEntries | undefined;
      if (first === undefined) throw new Error('no plan');
      const entries = first.entries.slice(0, 1).map((entry) => ({
        ...entry,
        sourceQuery: {
          ...entry.sourceQuery,
          params: { ...entry.sourceQuery.params, selected_semester: semester },
        },
      }));
      await local.set({
        [root]: {
          ...stored,
          activePlanId: '00000000-0000-4000-8000-000000000098',
          plans: [
            ...stored.plans,
            {
              ...first,
              id: '00000000-0000-4000-8000-000000000098',
              name: 'อีกภาค',
              semester,
              entries,
              updatedAt: new Date(Date.now() + 60_000).toISOString(),
            },
          ],
        },
      });
    },
    { root: ROOT_KEY, semester: other },
  );
}

/** Sample what the helper and the page show every 25 ms for the given time. */
async function sampleHelper(page: Page, ms: number): Promise<Sample[]> {
  return page.evaluate(async (span) => {
    const out: Sample[] = [];
    const root = (): ShadowRoot | null => {
      for (const node of Array.from(document.body.children)) {
        if (node.shadowRoot?.getElementById('kcp-launcher')) {
          return node.shadowRoot;
        }
      }
      return null;
    };
    const until = Date.now() + span;
    while (Date.now() < until) {
      const shadow = root();
      const card = shadow?.getElementById('kcp-regis-card') ?? null;
      out.push({
        loaded:
          document.querySelector('.v-main__wrap')?.childElementCount !== 0,
        chips: card?.querySelectorAll('[data-status]').length ?? 0,
        count: shadow?.getElementById('kcp-regis-count')?.textContent ?? null,
        reading:
          (card?.querySelector('[data-helper-reading]') ?? null) !== null,
        launcher: shadow?.getElementById('kcp-launcher')?.textContent ?? null,
        entryToast:
          (shadow?.querySelector('[data-entry-toast]') ?? null) !== null,
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return out;
  }, ms);
}

test('a reload never shows the active plan of another term, even while the page loads', async ({
  context,
  serviceWorker,
}) => {
  const page = await openPlanner(context);
  const { term } = await planWithKit(page, serviceWorker, SUBJECTS);
  await addNewerPlanOfAnotherTerm(serviceWorker, term);

  // The page shows nothing for two and a half seconds, as the live page does while it
  // loads, then renders its header and panel with the plan's own term.
  await page.goto(
    `${REGIS_ORIGIN}/replica/pre_registration?term=${term.semester}/${term.year}&loading=2500#/pre_registration`,
  );
  const samples = await sampleHelper(page, 6000);

  const loading = samples.filter((sample) => !sample.loaded);
  expect(loading.length).toBeGreaterThan(10);
  // While the page loads the helper names no plan: no chip, no count anywhere.
  for (const sample of loading) {
    expect(sample.chips).toBe(0);
    expect(sample.count).toBeNull();
    expect(sample.launcher ?? '').not.toContain('/');
  }
  expect(loading.some((sample) => sample.reading)).toBe(true);
  // At no moment does the other term's plan show, by its one subject count.
  for (const sample of samples) {
    expect(sample.count ?? '').not.toContain('/1');
    expect(sample.launcher ?? '').not.toContain('/1');
    expect(sample.entryToast).toBe(false);
  }
  // Once the page shows its term, the helper shows that term's plan.
  const card = page.locator('#kcp-regis-card');
  await expect(card.locator('#kcp-regis-count')).toContainText(
    `0/${String(SUBJECTS.length)}`,
  );
  // The entry toast never shows on this page, long after it would have elsewhere.
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-entry-toast]')).toHaveCount(0);
});

test('a page that loads past the term wait never shows the other term either', async ({
  context,
  serviceWorker,
}) => {
  test.setTimeout(90_000);
  const page = await openPlanner(context);
  const { term } = await planWithKit(page, serviceWorker, SUBJECTS);
  await addNewerPlanOfAnotherTerm(serviceWorker, term);
  // A phone, where the card starts folded and the launcher is the only surface.
  await page.setViewportSize({ width: 412, height: 915 });

  // The page stays empty for 19 s, past the usual 15 s wait for its term, as a slow page
  // at the registrar's busiest time does.
  await page.goto(
    `${REGIS_ORIGIN}/replica/pre_registration?term=${term.semester}/${term.year}&loading=19000#/pre_registration`,
  );
  const samples = await sampleHelper(page, 21_000);
  expect(samples.filter((sample) => !sample.loaded).length).toBeGreaterThan(
    100,
  );
  for (const sample of samples) {
    expect(sample.count ?? '').not.toContain('/1');
    expect(sample.launcher ?? '').not.toContain('/1');
  }
  await expect(page.locator('#kcp-launcher')).toContainText(
    `0/${String(SUBJECTS.length)}`,
  );
});
