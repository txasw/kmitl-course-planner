import type { Page } from '@playwright/test';
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
