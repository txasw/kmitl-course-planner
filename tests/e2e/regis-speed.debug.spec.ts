import type { Locator, Page, Worker } from '@playwright/test';
import { REGIS_ORIGIN } from '../../src/lib/shell/hostTab';
import { test, expect, openPlanner } from './support/fixtures';
import type { MockServer } from './support/mockServer';
import { denseSubjectId } from './support/denseCatalog';
import { planWithKit } from './support/regisKit';
import type {
  CatalogSubject,
  Replica,
} from './host/pre_registration/replica.js';

// How fast Add all for me runs on the replica of the app.a1e43722 route (ADR-0078, the
// timing amendment), with the host's eligibility read answering only when its request
// ends, 250 ms after it starts, as the host's own read does. The planned subjects are
// added one at a time, each in the order the host needs: the subject id typed, the
// host's read answered, the grade dialog acknowledged when the read raises it, the
// section menu opened, the section chosen, Add pressed, and the list row seen, before
// the next subject begins. The whole run is bounded, so a run that waits on a clock of
// its own rather than on the host's answers fails here. Each spec logs its breakdown.

declare global {
  interface Window {
    replica: Replica;
    kcpTimeline?: TimelineEvent[];
  }
}

interface TimelineEvent {
  t: number;
  kind: string;
}

const REPLICA_URL = `${REGIS_ORIGIN}/replica/pre_registration`;
const HASH = '#/pre_registration';
const DENSE_SEARCH = { id: '90000500', shows: denseSubjectId(0) };
/** How long the host's eligibility read takes, in ms. */
const LATENCY = 250;
/** The least time KCP shows a grade condition before it acknowledges the dialog. */
const CONDITION_SHOWN = 750;
/** The order of the events of one subject, as the host needs them. */
const READ_STEPS = ['input:subjectField', 'answer'];
const ADD_STEPS = [
  'click:sectionSelect',
  'click:option',
  'click:add',
  'listed',
];

function card(page: Page): Locator {
  return page.locator('#kcp-regis-card');
}

/**
 * Record, in the page, each event KCP dispatches on a host control and each answer of
 * the host it waits for, with the time it happened.
 */
async function recordTimeline(page: Page): Promise<void> {
  await page.evaluate(() => {
    const timeline: { t: number; kind: string }[] = [];
    window.kcpTimeline = timeline;
    const log = (kind: string) => {
      timeline.push({ t: performance.now(), kind });
    };
    for (const type of ['input', 'click']) {
      document.addEventListener(
        type,
        (event) => {
          if (event.isTrusted) {
            if (type === 'click') log('press');
            return;
          }
          const target = event.target;
          const name =
            target instanceof Element
              ? (target.closest('[data-count]')?.getAttribute('data-count') ??
                '?')
              : '?';
          log(`${type}:${name}`);
        },
        true,
      );
    }
    let loading = false;
    let listed = 0;
    new MutationObserver(() => {
      const { state } = window.replica;
      if (state.add.loading !== loading) {
        loading = state.add.loading;
        if (!loading) log('answer');
      }
      if (state.list.length !== listed) {
        listed = state.list.length;
        log('listed');
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
}

interface Run {
  subjects: readonly string[];
  /** The prerequisite ids the read of a subject raises the grade dialog with. */
  conditions?: Readonly<Record<string, readonly string[]>>;
  /** How often the host's period check runs, in ms, or 0 for only on a focus. */
  poll?: number;
}

/** Plan the subjects, open the route, press Add all for me, and time the run. */
async function timeAddAll(
  page: Page,
  serviceWorker: Worker,
  mock: MockServer,
  run: Run,
) {
  const { term, sections } = await planWithKit(
    page,
    serviceWorker,
    run.subjects,
    {},
    DENSE_SEARCH,
  );
  await page.goto(
    `${REPLICA_URL}?build=a1e43722&poll=${String(run.poll ?? 0)}${HASH}`,
  );
  await page.waitForFunction(() => 'replica' in window);
  const catalog: Record<string, CatalogSubject> = Object.fromEntries(
    run.subjects.map((id) => {
      const prerequisites = run.conditions?.[id];
      return [
        id,
        {
          sections: [{ section: sections[id] ?? '', kind: 'ท' as const }],
          ...(prerequisites === undefined
            ? {}
            : { prerequisites: [...prerequisites] }),
        },
      ];
    }),
  );
  await page.evaluate(
    ({ next, subjects, latency }) => {
      window.replica.set({ term: next, credits: { min: null, max: null } });
      window.replica.configure({ catalog: subjects, xhr: true, latency });
    },
    { next: term, subjects: catalog, latency: LATENCY },
  );
  await expect(card(page)).toBeVisible();
  mock.clearApiCalls();
  await recordTimeline(page);

  await card(page).getByRole('button', { name: 'เพิ่มเติม' }).click();
  const item = page
    .getByRole('menuitem', { name: 'เพิ่มให้ทุกวิชา' })
    .and(page.locator('[data-fill-press]'));
  await expect(item).toBeVisible();
  await page.waitForTimeout(700);
  await item.click();
  await expect(card(page)).toHaveAttribute('data-fill', 'done', {
    timeout: 60_000,
  });

  expect(
    await page.evaluate(() =>
      window.replica.state.list.map((row) => row.subjectId),
    ),
  ).toEqual(run.subjects);
  const timeline = await page.evaluate(() => window.kcpTimeline ?? []);
  const events = timeline.slice(
    timeline.findLastIndex((event) => event.kind === 'press'),
  );
  const start = events[0]?.t ?? Number.NaN;
  const steps = events.slice(1);
  const order = run.subjects.map((id) => [
    ...READ_STEPS,
    ...(run.conditions?.[id] === undefined ? [] : ['click:acknowledge']),
    ...ADD_STEPS,
  ]);

  // Every subject went through the host's steps in order, and no subject began before
  // the one before it was on the list.
  expect(steps.map((event) => event.kind)).toEqual(order.flat());
  let offset = 0;
  let before = start;
  const perSubject = run.subjects.map((id, index) => {
    const own = steps.slice(offset, offset + (order[index]?.length ?? 0));
    offset += own.length;
    const at = (kind: string) =>
      own.find((event) => event.kind === kind)?.t ?? Number.NaN;
    const dialog = run.conditions?.[id] !== undefined;
    const settled = dialog ? at('click:acknowledge') : at('answer');
    const breakdown = {
      id,
      typeId: Math.round(at('input:subjectField') - before),
      read: Math.round(at('answer') - at('input:subjectField')),
      ...(dialog
        ? { gradeDialog: Math.round(at('click:acknowledge') - at('answer')) }
        : {}),
      openMenu: Math.round(at('click:sectionSelect') - settled),
      choose: Math.round(at('click:option') - at('click:sectionSelect')),
      pressAdd: Math.round(at('click:add') - at('click:option')),
      listRow: Math.round(at('listed') - at('click:add')),
      total: Math.round(at('listed') - before),
    };
    before = at('listed');
    return breakdown;
  });
  const total = Math.round((steps.at(-1)?.t ?? Number.NaN) - start);
  // The breakdown, for the record of the run's timing in ADR-0078.
  console.log(JSON.stringify({ total, perSubject }));

  // The host's own answer bounds each read from below: KCP never runs ahead of it.
  for (const subject of perSubject) {
    expect(subject.read).toBeGreaterThanOrEqual(LATENCY - 10);
  }
  expect(await page.evaluate(() => window.replica.forbidden())).toBe(0);
  expect(await page.evaluate(() => window.replica.counters.writes)).toBe(0);
  expect(mock.apiCalls()).toEqual([]);
  return { total, perSubject };
}

test('adds eight subjects in order, bounded by the host answers', async ({
  context,
  mock,
  serviceWorker,
}) => {
  test.setTimeout(120_000);
  const page = await openPlanner(context);
  const subjects = Array.from({ length: 8 }, (_, index) =>
    denseSubjectId(index),
  );
  const { total } = await timeAddAll(page, serviceWorker, mock, { subjects });
  // Eight reads of 250 ms are 2 s; the rest of the run is KCP's own and the page's
  // render, which a fixed pace or a fixed wait would push far past this bound.
  expect(total).toBeLessThan(8 * LATENCY + 2000);
});

test('waits only on the shown condition at a grade dialog, through period checks', async ({
  context,
  mock,
  serviceWorker,
}) => {
  test.setTimeout(120_000);
  const page = await openPlanner(context);
  const subjects = Array.from({ length: 3 }, (_, index) =>
    denseSubjectId(index),
  );
  const graded = subjects[1] ?? '';
  const { total, perSubject } = await timeAddAll(page, serviceWorker, mock, {
    subjects,
    conditions: { [graded]: [denseSubjectId(9)] },
    poll: 1000,
  });
  const dialog = perSubject[1]?.gradeDialog ?? Number.NaN;
  // The condition shows for the least time before the acknowledgement, and the run
  // goes on the moment the dialog closes.
  expect(dialog).toBeGreaterThanOrEqual(CONDITION_SHOWN);
  expect(dialog).toBeLessThan(CONDITION_SHOWN + 600);
  expect(total).toBeLessThan(3 * LATENCY + CONDITION_SHOWN + 2000);
  expect(
    await page.evaluate(() => window.replica.counters.clicks.acknowledge),
  ).toBe(1);
});
