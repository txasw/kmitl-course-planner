import type { Locator, Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import { planWithKit } from './support/regisKit';
import { scanTextFit } from './support/textFit';
import type { Replica } from './host/pre_registration/replica.js';

// The registration helper card on the behaviour replica of the pre registration page
// (ADR-0076, design C2), in Thai at a laptop width and a phone width, and in English at a
// phone width for the hand off line and the complete step. The card opens on its own on
// every visit, collapses to the launcher and opens again on the next visit, takes each
// subject's status from the page alone, and Add for me on the subject in focus fills it
// through the host's own controls. Each spec ends by proving no control outside the
// allowlist got a press, nothing was written, and KCP sent no request.

declare global {
  interface Window {
    replica: Replica;
  }
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const SUBJECTS = ['90000001', '90000003', '90000005'] as const;
const [FIRST, SECOND] = SUBJECTS;
const LAUNCHER_ID = '#kcp-launcher';
const LANGUAGES = ['th', 'en'] as const;
type Language = (typeof LANGUAGES)[number];

/** The copy a spec reads in each language. */
const COPY: Readonly<
  Record<
    Language,
    {
      name: string;
      queue: string;
      handOff: string;
      notSent: string;
      notSentShort: string;
    }
  >
> = {
  th: {
    name: 'Thai',
    queue: 'รายวิชา',
    handOff:
      'ครบทุกวิชาตามแผนแล้ว ตรวจรายการในหน้า แล้วกด ดำเนินการต่อ เอง ลงทะเบียนล่วงหน้าส่งได้ครั้งเดียว',
    notSent: 'ไม่อยู่ในรายการที่ส่ง',
    notSentShort: 'ไม่ได้ส่ง',
  },
  en: {
    name: 'English',
    queue: 'Subjects',
    handOff:
      'Every planned subject is on the list. Check the list on the page, then press ดำเนินการต่อ (Continue) yourself. Pre registration can be sent only once.',
    notSent: 'Not in the submitted list',
    notSentShort: 'Not sent',
  },
};

function card(page: Page): Locator {
  return page.locator('#kcp-regis-card');
}

function chip(page: Page, subjectId: string): Locator {
  return card(page)
    .getByRole('list', { name: 'รายวิชา' })
    .locator(`[data-status][aria-label^="${subjectId}"]`);
}

/**
 * Plan the subjects at the planner's desktop size, in Thai, then switch the panel to the
 * given language and open the page at this width.
 */
async function openHelper(
  page: Page,
  serviceWorker: Worker,
  viewport: { width: number; height: number },
  language: Language = 'th',
): Promise<void> {
  const { term, sections } = await planWithKit(page, serviceWorker, SUBJECTS, {
    [SECOND]: [{ teachTableId: '900004', section: '902', day: 3 }],
  });
  if (language === 'en') {
    await page.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(
      page.getByRole('button', { name: 'More options' }),
    ).toBeVisible();
  }
  await page.setViewportSize(viewport);
  await page.goto(`${REPLICA_URL}${HASH}`);
  await page.waitForFunction(() => 'replica' in window);
  await page.evaluate(
    ({ next, catalog }) => {
      window.replica.set({ term: next });
      window.replica.configure({ catalog, xhr: true });
    },
    {
      next: term,
      catalog: Object.fromEntries(
        SUBJECTS.map((id) => [
          id,
          { sections: [{ section: sections[id] ?? '', kind: 'ท' as const }] },
        ]),
      ),
    },
  );
}

async function expectNothingForbidden(page: Page): Promise<void> {
  const counters = await page.evaluate(() => ({
    forbidden: window.replica.forbidden(),
    writes: window.replica.counters.writes,
    confirm: window.replica.counters.clicks.confirm ?? 0,
    continue: window.replica.counters.clicks.continue ?? 0,
  }));
  expect(counters).toEqual({
    forbidden: 0,
    writes: 0,
    confirm: 0,
    continue: 0,
  });
}

test.describe('at a laptop width', () => {
  test('opens on every visit, reads the page, and adds for me', async ({
    context,
    mock,
    serviceWorker,
  }) => {
    const page = await openPlanner(context);
    await openHelper(page, serviceWorker, { width: 1366, height: 768 });
    mock.clearApiCalls();

    // Open with no press, in Thai, every id in full, and no native select.
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute('lang', 'th');
    for (const id of SUBJECTS) await expect(chip(page, id)).toHaveText(id);
    await expect(card(page).locator('select')).toHaveCount(0);
    await expect(page.locator(LAUNCHER_ID)).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // The status is the page's own.
    await page.evaluate((id) => {
      window.replica.set({
        list: [{ subjectId: id, section: '901', kind: 'ท' }],
      });
    }, FIRST);
    await expect(chip(page, FIRST)).toHaveAttribute('data-status', 'added');
    await expect(chip(page, SECOND)).toHaveAttribute('data-status', 'todo');
    await expect(card(page).locator('#kcp-regis-count')).toContainText('1/3');

    // A press on the page leaves the card open at this width.
    await page.locator('input').first().click();
    await expect(card(page)).toBeVisible();

    // The launcher collapses it, and the next visit opens it again.
    await page.locator(LAUNCHER_ID).click();
    await expect(card(page)).toHaveCount(0);
    await page.evaluate(() => {
      window.location.hash = '#/teach_table_selector';
    });
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, HASH);
    await expect(card(page)).toBeVisible();

    // Add for me fills the subject in focus, the first one the page does not list.
    await expect(chip(page, SECOND)).toHaveAttribute('aria-current', 'true');
    const add = card(page)
      .getByRole('button', { name: 'เพิ่มให้', exact: true })
      .and(page.locator('[data-fill-press]'));
    await expect(add).toBeVisible();
    await page.waitForTimeout(700);
    await add.click();
    await expect(card(page)).toHaveAttribute('data-fill', 'done', {
      timeout: 15_000,
    });
    await expect(chip(page, SECOND)).toHaveAttribute('data-status', 'added');
    await expectNothingForbidden(page);

    // Hide on this page removes the card and the launcher until the next visit.
    await card(page).getByRole('button', { name: 'เพิ่มเติม' }).click();
    await page.getByRole('menuitem', { name: 'ซ่อนในหน้านี้' }).click();
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator(LAUNCHER_ID)).toHaveCount(0);
    expect(mock.apiCalls()).toEqual([]);
  });
});

test.describe('Add all for me', () => {
  test('adds every subject still to add in one run, one at a time', async ({
    context,
    mock,
    serviceWorker,
  }) => {
    const page = await openPlanner(context);
    await openHelper(page, serviceWorker, { width: 1366, height: 768 });
    mock.clearApiCalls();
    await expect(card(page)).toBeVisible();

    // The first subject is already on the page, so the press names the other two.
    await page.evaluate((id) => {
      window.replica.set({
        list: [{ subjectId: id, section: '901', kind: 'ท' }],
      });
    }, FIRST);
    await expect(chip(page, FIRST)).toHaveAttribute('data-status', 'added');

    await card(page).getByRole('button', { name: 'เพิ่มเติม' }).click();
    const addAll = page
      .getByRole('menuitem', { name: 'เพิ่มให้ทุกวิชา' })
      .and(page.locator('[data-fill-press]'));
    await expect(addAll).toBeVisible();
    await page.waitForTimeout(700);
    await addAll.click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(card(page)).toHaveAttribute('data-fill', 'running');
    await expect(card(page)).toHaveAttribute('data-fill', 'done', {
      timeout: 30_000,
    });
    for (const id of SUBJECTS) {
      await expect(chip(page, id)).toHaveAttribute('data-status', 'added');
    }
    // With every subject on the list, one line hands the submit to the student.
    await expect(card(page).locator('[data-helper-handoff]')).toHaveCount(1);
    const listed = await page.evaluate(() =>
      window.replica.state.list.map((row) => row.subjectId),
    );
    expect(listed).toEqual([...SUBJECTS]);
    await expectNothingForbidden(page);
    expect(mock.apiCalls()).toEqual([]);

    // With nothing left to add the menu offers no Add all for me.
    await card(page).getByRole('button', { name: 'เพิ่มเติม' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'เพิ่มให้ทุกวิชา' }),
    ).toHaveCount(0);
  });
});

test.describe('at a phone width', () => {
  test('starts folded, opens on a press, lists every subject, and folds away on a page tap', async ({
    context,
    mock,
    serviceWorker,
  }) => {
    const page = await openPlanner(context);
    await openHelper(page, serviceWorker, { width: 390, height: 844 });
    mock.clearApiCalls();

    // On a phone the host page reads first: the card waits behind the launcher, which
    // carries the count, until the student opens it.
    const launcher = page.locator(LAUNCHER_ID);
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await expect(launcher).toContainText(`0/${String(SUBJECTS.length)}`);
    await expect(card(page)).toHaveCount(0);
    await launcher.click();
    await expect(card(page)).toBeVisible();
    // Open, the launcher drops the count the card's header now shows.
    await expect(launcher).not.toContainText('/');
    await expect(card(page)).toHaveAttribute('lang', 'th');

    // The count opens the list of every subject, and a row puts it in focus.
    const count = card(page).locator('#kcp-regis-count');
    await count.click();
    await expect(count).toHaveAttribute('aria-expanded', 'true');
    const list = card(page).locator('#kcp-regis-list');
    await expect(list.locator('li')).toHaveCount(SUBJECTS.length);
    await list.getByRole('button', { name: new RegExp(`^${FIRST}`) }).click();
    await expect(count).toHaveAttribute('aria-expanded', 'false');
    await expect(chip(page, FIRST)).toHaveAttribute('aria-current', 'true');

    // A press on the page above the card folds it to the launcher.
    await page.getByRole('heading', { level: 2 }).first().click();
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator(LAUNCHER_ID)).toBeVisible();
    await page.locator(LAUNCHER_ID).click();
    await expect(card(page)).toBeVisible();

    await expectNothingForbidden(page);
    expect(mock.apiCalls()).toEqual([]);
  });

  // The hand off line and the complete step's statuses, in each language, at the narrowest
  // phone width: the English line is the longer one, and the not sent band and its short
  // word in the list's status column are the longest words the complete step adds.
  for (const language of LANGUAGES) {
    const copy = COPY[language];
    test(`hands the submit to the student in one line that fits, in ${copy.name}`, async ({
      context,
      mock,
      serviceWorker,
    }) => {
      const page = await openPlanner(context);
      await openHelper(
        page,
        serviceWorker,
        { width: 360, height: 740 },
        language,
      );
      mock.clearApiCalls();
      await page.locator(LAUNCHER_ID).click();
      await expect(card(page)).toBeVisible();
      await expect(card(page)).toHaveAttribute('lang', language);
      const line = card(page).locator('[data-helper-handoff]');
      await expect(line).toHaveCount(0);
      const status = (id: string) =>
        card(page)
          .getByRole('list', { name: copy.queue })
          .locator(`[data-status][aria-label^="${id}"]`);

      const focused = () =>
        page.evaluate(() => document.activeElement?.outerHTML ?? null);
      const before = await focused();
      await page.evaluate((ids) => {
        window.replica.set({
          list: ids.map((id) => ({ subjectId: id, section: '901', kind: 'ท' })),
        });
      }, SUBJECTS);
      for (const id of SUBJECTS) {
        await expect(status(id)).toHaveAttribute('data-status', 'added');
      }
      await expect(line).toHaveCount(1);
      await expect(line).toHaveText(copy.handOff);
      await expect(line).toBeInViewport({ ratio: 1 });
      // The line names the host control as text: nothing in it can be pressed, it moved
      // no focus, and no text on the card is cut or covered at this width.
      await expect(line.locator('button, a, [tabindex]')).toHaveCount(0);
      expect(await focused()).toBe(before);
      expect(await scanTextFit(card(page), [])).toEqual([]);

      // A subject off the list again takes the line away.
      await page.evaluate((id) => {
        window.replica.set({
          list: [{ subjectId: id, section: '901', kind: 'ท' }],
        });
      }, FIRST);
      await expect(line).toHaveCount(0);

      // On the complete step the first subject is missing from the submitted list. Its
      // band and its short word in the list fit, with nothing cut or covered.
      await page.evaluate((ids) => {
        window.replica.set({
          step: 3,
          results: ids.map((id) => ({
            subjectId: id,
            section: '901',
            kind: 'ท',
            grade: '',
          })),
        });
      }, SUBJECTS.slice(1));
      await expect(status(FIRST)).toHaveAttribute('data-status', 'notSent');
      await expect(card(page)).toContainText(copy.notSent);
      await expect(line).toHaveCount(0);
      expect(await scanTextFit(card(page), [])).toEqual([]);
      const count = card(page).locator('#kcp-regis-count');
      await count.click();
      const list = card(page).locator('#kcp-regis-list');
      await expect(list).toContainText(copy.notSentShort);
      expect(await scanTextFit(card(page), [])).toEqual([]);

      await expectNothingForbidden(page);
      expect(mock.apiCalls()).toEqual([]);
    });
  }
});
