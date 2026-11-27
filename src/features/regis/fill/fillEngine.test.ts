import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mountReplica,
  type CatalogSubject,
  type Replica,
  type ReplicaConfig,
  type ReplicaPatch,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../../tests/support/domain-builders';
import type { Section } from '@/lib/domain/types';
import { deriveChecklist } from '@/lib/regis/checklist';
import { fillTarget, type FillTarget } from '@/lib/regis/fillPlan';
import { buildRegistrationKit } from '@/lib/regis/kit';
import { toSnapshot } from '@/lib/planner/transaction';
import {
  FILL_TIMING,
  runFill,
  type FillDeps,
  type FillStep,
  type FillTiming,
} from './fillEngine';
import { watchPage, type PageWatch } from './pageWatch';
import { startTripwire } from './tripwire';

type Callback = (list: { getEntries: () => PerformanceEntry[] }) => void;

function resourceEntry(name: string): PerformanceEntry {
  // Test only: a plain object standing in for a resource entry, which jsdom lacks.
  return {
    initiatorType: 'xmlhttprequest',
    name,
  } as unknown as PerformanceEntry;
}

// The engine against the behaviour replica: each subject is entered, its sections are
// chosen through the host's own menus, and Add is pressed, one step at a time; every
// stop leaves the page as the host left it. Every case ends by asserting that no control
// outside the allowlist got a press or an event and that nothing was written.

// Weekdays, so no two test sections meet at once.
const DAYS = [1, 2, 3, 4, 5, 6] as const;
const A = '01476107';
const B = '01476106';

interface Spec {
  id: string;
  /** Sections as [code, kind, pair], the first of each kind planned. */
  sections: [string, 'lecture' | 'practice', string | null][];
  planned: string[];
  day?: number;
  /** The meeting start in minutes, 09:00 unless named. */
  start?: number;
}

function setup(specs: Spec[]) {
  const courses = specs.map((spec) =>
    makeCourse({
      subjectId: spec.id,
      sections: spec.sections.map(([code, kind, pair], index): Section =>
        makeSection({
          teachTableId: `${spec.id}-${code}`,
          subjectId: spec.id,
          section: code,
          kind,
          pairedSection: pair,
          meetings: [
            makeMeeting({
              day: DAYS[((spec.day ?? 0) + index) % DAYS.length] ?? 1,
              startMin: spec.start ?? 540,
              endMin: (spec.start ?? 540) + 60,
            }),
          ],
        }),
      ),
    }),
  );
  const plan = makePlan({
    entries: courses.flatMap((course, index) =>
      course.sections
        .filter((section) => specs[index]?.planned.includes(section.section))
        .map((section) =>
          makePlanEntry({
            subjectId: section.subjectId,
            teachTableId: section.teachTableId,
            section: section.section,
            snapshot: toSnapshot(course, section),
          }),
        ),
    ),
  });
  const kit = buildRegistrationKit({
    plan,
    results: new Map(
      courses.map((course) => [
        course.subjectId,
        {
          courses: [course],
          duplicateCount: 0,
          multiMeetingCount: 0,
          warnings: [],
        },
      ]),
    ),
    preparedAt: '2026-11-22T14:10:00.000Z',
  });
  const targets = deriveChecklist({ plan, kit, choices: null, pageTerm: null })
    .rows.map((row) => fillTarget(row, plan, kit))
    .filter((target): target is FillTarget => typeof target !== 'string');
  const catalog: Record<string, CatalogSubject> = Object.fromEntries(
    specs.map((spec) => [
      spec.id,
      {
        sections: spec.sections.map(([section, kind, pair]) => ({
          section,
          kind: kind === 'lecture' ? 'ท' : 'ป',
          pair,
        })),
      },
    ]),
  );
  return { plan, kit, targets, catalog };
}

const SINGLE: Spec = {
  id: A,
  sections: [
    ['1', 'lecture', null],
    ['2', 'lecture', null],
  ],
  planned: ['1'],
};
const LOCKED: Spec = {
  id: A,
  sections: [
    ['1', 'lecture', '101'],
    ['101', 'practice', '1'],
  ],
  planned: ['1', '101'],
};
const FREE: Spec = {
  id: A,
  sections: [
    ['1', 'lecture', null],
    ['101', 'practice', null],
    ['102', 'practice', null],
  ],
  planned: ['1', '102'],
};

let replica: Replica | null = null;

afterEach(() => {
  expect(replica?.forbidden() ?? 0).toBe(0);
  replica?.destroy();
  document.body.replaceChildren();
  replica = null;
});

interface RunOptions {
  patch?: ReplicaPatch;
  config?: ReplicaConfig;
  subjects?: (
    catalog: Record<string, CatalogSubject>,
  ) => Record<string, CatalogSubject>;
  allowFull?: string[];
  stopAfter?: FillStep;
  /** When KCP's UI began showing the condition, or null while it does not. */
  shownSince?: number | null;
  /** The step at which the student opens the host's confirm dialog. */
  confirmAt?: FillStep;
}

async function fill(specs: Spec[], options: RunOptions = {}) {
  const { plan, kit, targets, catalog } = setup(specs);
  replica = mountReplica(document, options.patch ?? {});
  replica.configure({
    delay: 5,
    catalog: options.subjects?.(catalog) ?? catalog,
    ...options.config,
  });
  const steps: { step: FillStep; prerequisites: readonly string[] }[] = [];
  let refusals = 0;
  let stopped = false;
  const deps: FillDeps = {
    doc: document,
    plan,
    kit,
    targets,
    allowFull: new Set(options.allowFull ?? []),
    stopRequested: () => stopped,
    onStep: (_subject, step, prerequisites) => {
      steps.push({ step, prerequisites });
      if (step === options.stopAfter) stopped = true;
      if (step === options.confirmAt)
        replica?.set({ dialog: { kind: 'confirm' } });
    },
    onRefusal: () => {
      refusals += 1;
    },
    conditionShownSince: () =>
      options.shownSince === undefined ? 0 : options.shownSince,
    tripwire: { count: () => 0, quiet: () => true, stop: () => undefined },
    timing: {
      poll: 2,
      answer: 150,
      settle: 150,
      acknowledge: 0,
      quiet: 0,
    },
  };
  const outcome = await runFill(deps);
  return { outcome, steps, refusals, page: replica };
}

describe('runFill', () => {
  it('enters a subject, chooses its section, and presses Add', async () => {
    const { outcome, steps, page } = await fill([SINGLE]);
    expect(outcome).toEqual({ status: 'done', filled: 1 });
    expect(page.state.list.map((row) => row.section)).toEqual(['1']);
    expect(steps.map((item) => item.step)).toEqual([
      'enter',
      'wait',
      'choose',
      'add',
    ]);
    expect(page.counters.reads).toBe(1);
  });

  it('fills a locked pair through the lecture alone', async () => {
    const { outcome, page } = await fill([LOCKED]);
    expect(outcome.status).toBe('done');
    expect(page.state.list.map((row) => row.section)).toEqual(['1', '101']);
  });

  it('chooses the practice of a free pair in its own select', async () => {
    const { outcome, page } = await fill([FREE]);
    expect(outcome.status).toBe('done');
    expect(page.state.list.map((row) => row.section)).toEqual(['1', '102']);
  });

  it.each([
    [
      'locks a practice to the lecture',
      [
        ['1', 'lecture', '101'],
        ['101', 'practice', '1'],
      ] as Spec['sections'],
    ],
    [
      'asks for a practice',
      [
        ['1', 'lecture', null],
        ['101', 'practice', null],
      ] as Spec['sections'],
    ],
  ])(
    'presses no Add when the page %s the plan does not hold',
    async (_name, sections) => {
      // The plan holds the lecture alone, as a plan made before the pair was declared.
      const { plan, kit, targets, catalog } = setup([
        { id: A, sections, planned: ['1'] },
      ]);
      replica = mountReplica(document);
      replica.configure({ delay: 5, catalog });
      const outcome = await runFill({
        doc: document,
        plan,
        kit,
        targets,
        allowFull: new Set(),
        stopRequested: () => false,
        onStep: () => undefined,
        onRefusal: () => undefined,
        conditionShownSince: () => 0,
        tripwire: { count: () => 0, quiet: () => true, stop: () => undefined },
        timing: {
          poll: 2,
          answer: 150,
          settle: 150,
          acknowledge: 0,
          quiet: 0,
        },
      });
      expect(outcome).toMatchObject({
        status: 'stopped',
        reason: 'practiceUnplanned',
      });
      expect(replica.counters.clicks.add ?? 0).toBe(0);
      expect(replica.state.list).toEqual([]);
    },
  );

  it('fills every named subject one at a time', async () => {
    const { outcome, page } = await fill([
      SINGLE,
      { id: B, sections: [['3', 'lecture', null]], planned: ['3'], day: 4 },
    ]);
    expect(outcome).toEqual({ status: 'done', filled: 2 });
    expect(page.counters.reads).toBe(2);
    // The checklist orders the rows, and the run follows it.
    expect(page.state.list.map((row) => row.subjectId)).toEqual([B, A]);
  });

  it('shows the condition, then acknowledges the grade dialog and goes on', async () => {
    const { outcome, steps, page } = await fill([SINGLE], {
      subjects: (catalog) => ({
        [A]: {
          ...catalog[A],
          sections: catalog[A]?.sections ?? [],
          prerequisites: ['01476105'],
        },
      }),
    });
    expect(outcome.status).toBe('done');
    const shown = steps.findIndex((item) => item.step === 'conditional');
    expect(steps[shown]?.prerequisites).toEqual(['01476105']);
    expect(steps.findIndex((item) => item.step === 'choose')).toBeGreaterThan(
      shown,
    );
    expect(page.counters.clicks.acknowledge).toBe(1);
  });

  it.each([
    ['while KCP does not show the condition', null],
    ['when KCP began showing it only now', Number.POSITIVE_INFINITY],
  ])('leaves the grade dialog to the student %s', async (_name, shownSince) => {
    const { outcome, page } = await fill([SINGLE], {
      subjects: (catalog) => ({
        [A]: {
          ...catalog[A],
          sections: catalog[A]?.sections ?? [],
          prerequisites: ['01476105'],
        },
      }),
      shownSince,
    });
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'dialogOpen' });
    expect(page.counters.clicks.acknowledge ?? 0).toBe(0);
    expect(page.counters.clicks.add ?? 0).toBe(0);
    expect(page.state.list).toEqual([]);
  });

  it.each(['wait', 'choose', 'add'] as const)(
    'stops at the %s step the moment the confirm dialog opens',
    async (step) => {
      const { outcome, steps, page } = await fill(
        [SINGLE, { ...SINGLE, id: B }],
        {
          confirmAt: step,
        },
      );
      expect(outcome).toMatchObject({
        status: 'stopped',
        reason: 'confirmOpen',
      });
      // The run ends on the first subject, at the step the dialog opened in.
      expect(steps.filter((item) => item.step === 'enter')).toHaveLength(1);
      expect(steps.at(-1)?.step).toBe(step);
      expect(page.state.dialog).toEqual({ kind: 'confirm' });
      expect(page.counters.clicks.add ?? 0).toBe(0);
      expect(page.counters.clicks.confirm ?? 0).toBe(0);
      expect(page.counters.clicks.back ?? 0).toBe(0);
      expect(page.counters.writes).toBe(0);
      expect(page.state.list).toEqual([]);
    },
  );

  it('starts nothing while the confirm dialog is open', async () => {
    const { outcome, steps, page } = await fill([SINGLE], {
      patch: { dialog: { kind: 'confirm' } },
    });
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'confirmOpen' });
    expect(steps).toEqual([]);
    expect(page.interactions()).toBe(0);
  });

  it('skips a subject the page already lists as planned', async () => {
    const { outcome, page } = await fill([SINGLE], {
      patch: { list: [{ subjectId: A, section: '1', kind: 'ท' }] },
    });
    expect(outcome).toEqual({ status: 'done', filled: 0 });
    expect(page.counters.reads).toBe(0);
  });

  it.each([
    [
      'a refusal',
      { subjects: () => ({ [A]: { sections: [], refused: true } }) },
      'refused',
    ],
    [
      'a host clash',
      {
        subjects: (catalog: Record<string, CatalogSubject>) => ({
          [A]: { sections: catalog[A]?.sections ?? [], clash: true },
        }),
      },
      'hostClash',
    ],
    [
      'a code under two curricula',
      {
        subjects: () => ({
          [A]: {
            sections: [
              { section: '1', kind: 'ท' as const, curriculum: 'CE' },
              { section: '1', kind: 'ท' as const, curriculum: 'EE' },
            ],
          },
        }),
      },
      'duplicateCode',
    ],
    [
      'an over subscribed section',
      {
        subjects: () => ({
          [A]: {
            sections: [
              { section: '1', kind: 'ท' as const, limit: 40, count: 40 },
            ],
          },
        }),
      },
      'full',
    ],
    [
      'a host that never answers',
      { subjects: () => ({ [A]: { sections: [], hang: true } }) },
      'noAnswer',
    ],
    [
      'text left in the field',
      { patch: { add: { value: '0147' } } },
      'fieldNotEmpty',
    ],
    ['a press on Stop', { stopAfter: 'wait' as const }, 'stopped'],
    [
      'Add relabelled as Continue',
      { config: { variant: 'continueAsAdd' as const } },
      'notRecognised',
    ],
    [
      'Add and Continue swapped',
      { config: { variant: 'swapped' as const } },
      'notRecognised',
    ],
    [
      'focus moved to Continue',
      { config: { variant: 'focusContinue' as const } },
      'pageChanged',
    ],
    [
      'an option inside a label for Continue',
      { config: { variant: 'labelledOption' as const } },
      'notRecognised',
    ],
    [
      'an Add that submits a form elsewhere',
      { config: { variant: 'formAdd' as const } },
      'notRecognised',
    ],
  ])(
    'stops on %s and leaves the page to the student',
    async (_name, options, reason) => {
      const { outcome, page } = await fill([SINGLE], options);
      expect(outcome).toMatchObject({
        status: 'stopped',
        subjectId: A,
        reason,
      });
      expect(page.state.list).toEqual([]);
    },
  );

  it('fills an over subscribed section once the student asks to', async () => {
    const { outcome } = await fill([SINGLE], {
      allowFull: [A],
      subjects: () => ({
        [A]: { sections: [{ section: '1', kind: 'ท', limit: 40, count: 40 }] },
      }),
    });
    expect(outcome.status).toBe('done');
  });

  it.each(['confirmAsGrade', 'gradeConfirmButton'] as const)(
    'presses nothing in a grade dialog that is %s',
    async (variant) => {
      const { outcome, page } = await fill([SINGLE], {
        config: { variant },
        subjects: (catalog) => ({
          [A]: {
            sections: catalog[A]?.sections ?? [],
            prerequisites: ['01476105'],
          },
        }),
      });
      expect(outcome).toMatchObject({
        status: 'stopped',
        reason: 'notRecognised',
      });
      expect(page.counters.clicks.confirm ?? 0).toBe(0);
    },
  );

  it('never sends a key, so a page that submits on Enter submits nothing', async () => {
    const { outcome, page } = await fill([SINGLE], {
      config: { variant: 'enterSubmits' },
    });
    expect(outcome.status).toBe('done');
    expect(page.counters.clicks.enter ?? 0).toBe(0);
  });

  it('never presses an Add button relabelled as Confirm once the row fits', async () => {
    const { plan, kit, targets, catalog } = setup([SINGLE]);
    replica = mountReplica(document);
    replica.configure({ delay: 5, catalog });
    const relabel = new MutationObserver(() => {
      const label = document.querySelector(
        '[data-count="add"] .v-btn__content',
      );
      if (
        label?.textContent.trim() === 'เพิ่ม' &&
        replica?.state.add.colour === 'fits'
      ) {
        label.textContent = 'ยืนยัน';
      }
    });
    relabel.observe(document.body, { subtree: true, childList: true });
    const outcome = await runFill({
      doc: document,
      plan,
      kit,
      targets,
      allowFull: new Set(),
      stopRequested: () => false,
      onStep: () => undefined,
      onRefusal: () => undefined,
      conditionShownSince: () => 0,
      tripwire: { count: () => 0, quiet: () => true, stop: () => undefined },
      timing: {
        poll: 2,
        answer: 150,
        settle: 150,
        acknowledge: 0,
        quiet: 0,
      },
    });
    relabel.disconnect();
    expect(outcome).toMatchObject({
      status: 'stopped',
      reason: 'notRecognised',
    });
    expect(replica.state.list).toEqual([]);
    expect(replica.counters.clicks.add ?? 0).toBe(0);
  });

  it('chooses no option whose curriculum changed after the list was read', async () => {
    const { plan, kit, targets, catalog } = setup([SINGLE]);
    replica = mountReplica(document);
    replica.configure({ delay: 5, catalog });
    let changed = false;
    // After the engine reads the open list, the same code gains a curriculum the kit
    // does not explain, in the task between that reading and the option's click.
    const swap = (doc: Document): PageWatch => {
      const real = watchPage(doc);
      return {
        ...real,
        task: async () => {
          await real.task();
          const title = doc.querySelector(
            '[role="option"] .v-list-item__title',
          );
          if (changed || title === null) return;
          changed = true;
          title.textContent = ' 1  (EE) ';
        },
      };
    };
    const outcome = await runFill({
      doc: document,
      plan,
      kit,
      targets,
      allowFull: new Set(),
      stopRequested: () => false,
      onStep: () => undefined,
      onRefusal: () => undefined,
      conditionShownSince: () => 0,
      tripwire: { count: () => 0, quiet: () => true, stop: () => undefined },
      timing: {
        poll: 2,
        answer: 300,
        settle: 300,
        acknowledge: 0,
        quiet: 0,
      },
      watchPage: swap,
    });
    expect(changed).toBe(true);
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'pageChanged' });
    expect(replica.counters.clicks.option ?? 0).toBe(0);
    expect(replica.state.list).toEqual([]);
  });

  it('leaves a code under two curricula to the student, then adds their pick', async () => {
    const { plan, kit, catalog } = setup([SINGLE]);
    const flagged = {
      ...kit,
      subjects: kit.subjects.map((subject) => ({
        ...subject,
        duplicateCodes: ['1'],
      })),
    };
    const targets = deriveChecklist({
      plan,
      kit: flagged,
      choices: null,
      pageTerm: null,
    })
      .rows.map((row) => fillTarget(row, plan, flagged))
      .filter((target): target is FillTarget => typeof target !== 'string');
    replica = mountReplica(document);
    replica.configure({ delay: 5, catalog });
    const run = () =>
      runFill({
        doc: document,
        plan,
        kit: flagged,
        targets,
        allowFull: new Set(),
        stopRequested: () => false,
        onStep: () => undefined,
        onRefusal: () => undefined,
        conditionShownSince: () => 0,
        tripwire: { count: () => 0, quiet: () => true, stop: () => undefined },
        timing: {
          poll: 2,
          answer: 150,
          settle: 150,
          acknowledge: 0,
          quiet: 0,
        },
      });
    expect(await run()).toMatchObject({
      status: 'stopped',
      reason: 'duplicateCode',
    });
    expect(replica.counters.clicks.option ?? 0).toBe(0);
    expect(replica.state.list).toEqual([]);
    // The student picks their own curriculum's row, then presses Continue.
    replica.pick('primary', 0);
    expect(await run()).toEqual({ status: 'done', filled: 1 });
    expect(replica.state.list.map((row) => row.section)).toEqual(['1']);
    expect(replica.counters.reads).toBe(1);
  });

  it('stops when the page starts a request it did not expect', async () => {
    const { plan, kit, targets, catalog } = setup([SINGLE]);
    replica = mountReplica(document);
    replica.configure({ delay: 5, catalog });
    let seen = 0;
    const outcome = await runFill({
      doc: document,
      plan,
      kit,
      targets,
      allowFull: new Set(),
      stopRequested: () => false,
      onStep: (_subject, step) => {
        if (step === 'choose') seen = 1;
      },
      onRefusal: () => undefined,
      conditionShownSince: () => 0,
      tripwire: { count: () => seen, quiet: () => true, stop: () => undefined },
      timing: {
        poll: 2,
        answer: 150,
        settle: 150,
        acknowledge: 0,
        quiet: 0,
      },
    });
    expect(outcome).toMatchObject({
      status: 'stopped',
      reason: 'pageRequest',
    });
    expect(replica.state.list).toEqual([]);
  });
});

describe('runFill on the route of app.a1e43722', () => {
  const ROUTE_TIMING: FillTiming = {
    poll: 2,
    answer: 5000,
    settle: 150,
    acknowledge: 0,
    quiet: 0,
  };
  // A quiet spell long enough to outlast a request started just before the run.
  const QUIET: FillTiming = { ...ROUTE_TIMING, quiet: 100, settle: 1000 };

  // The build's period check can unmount the panel with no navigation, and mount it
  // again from its own empty data; a run never acts on a page without a panel.
  function deps(
    setupOf: ReturnType<typeof setup>,
    onStep: FillDeps['onStep'] = () => undefined,
  ): FillDeps {
    return {
      doc: document,
      plan: setupOf.plan,
      kit: setupOf.kit,
      targets: setupOf.targets,
      allowFull: new Set(),
      stopRequested: () => false,
      onStep,
      onRefusal: () => undefined,
      conditionShownSince: () => 0,
      tripwire: { count: () => 0, quiet: () => true, stop: () => undefined },
      timing: ROUTE_TIMING,
    };
  }

  it('fills through the route card around the panel', async () => {
    const setupOf = setup([SINGLE]);
    replica = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica.configure({ delay: 5, catalog: setupOf.catalog });
    expect(await runFill(deps(setupOf))).toEqual({
      status: 'done',
      filled: 1,
    });
    expect(replica.state.list.map((row) => row.section)).toEqual(['1']);
  });

  it('stops at once when the panel unmounts under a run, and acts on nothing more', async () => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 300, catalog: setupOf.catalog });
    const started = Date.now();
    const outcome = await runFill(
      deps(setupOf, (_subject, step) => {
        // The period closes while the host reads the entered subject.
        if (step === 'wait') {
          setTimeout(() => {
            page.set({ period: 'closed' });
          }, 20);
        }
      }),
    );
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'pageChanged' });
    // Well before the 5 s answer ceiling, so the run waited for nothing.
    expect(Date.now() - started).toBeLessThan(1000);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(page.state.list).toEqual([]);
    expect(Object.keys(page.counters.untrustedOn)).toEqual(['subjectField']);
    expect(page.counters.clicks).toEqual({});
  });

  it('stops when the host mounts a new panel between two subjects', async () => {
    const setupOf = setup([SINGLE, { ...SINGLE, id: B, day: 3 }]);
    const late = setupOf.targets[1]?.subjectId;
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 0, catalog: setupOf.catalog });
    let remounted = false;
    const outcome = await runFill({
      ...deps(setupOf),
      tripwire: {
        // Two period answers just after the first subject's last check, so no reading
        // ever finds the page without a panel, and the new panel has lost that subject.
        count: () => {
          if (page.state.list.length === 1 && !remounted) {
            remounted = true;
            queueMicrotask(() => {
              page.set({ period: 'closed' });
              page.set({ period: 'open' });
            });
          }
          return 0;
        },
        quiet: () => true,
        stop: () => undefined,
      },
    });
    expect(remounted).toBe(true);
    expect(outcome).toMatchObject({
      status: 'stopped',
      subjectId: late,
      reason: 'pageChanged',
    });
    expect(page.state.list).toEqual([]);
    expect(page.counters.untrustedOn.subjectField).toBe(1);
  });

  it('starts nothing while the period keeps the panel unmounted', async () => {
    const setupOf = setup([SINGLE]);
    replica = mountReplica(
      document,
      { period: 'before' },
      { route: 'a1e43722', poll: 0 },
    );
    replica.configure({ delay: 5, catalog: setupOf.catalog });
    expect(await runFill(deps(setupOf))).toMatchObject({
      status: 'stopped',
      reason: 'notReady',
    });
    expect(replica.interactions()).toBe(0);
  });

  it('fills the panel the host mounted again from its empty data', async () => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(
      document,
      { period: 'closed' },
      { route: 'a1e43722', poll: 0 },
    );
    replica = page;
    page.configure({ delay: 50, catalog: setupOf.catalog });
    page.set({ period: 'open' });
    // The add card reads its credits first, with the card loading, and the run waits,
    // showing the subject waiting in the dock rather than the step before.
    expect(page.state.add.loading).toBe(true);
    const steps: FillStep[] = [];
    expect(
      await runFill(
        deps(setupOf, (_subject, step) => {
          steps.push(step);
        }),
      ),
    ).toEqual({
      status: 'done',
      filled: 1,
    });
    expect(steps).toEqual(['wait', 'enter', 'wait', 'choose', 'add']);
    expect(page.state.list.map((row) => row.section)).toEqual(['1']);
  });

  it('stops with its own reason when the add card never finishes loading', async () => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 5, catalog: setupOf.catalog });
    page.set({ add: { loading: true } });
    const steps: FillStep[] = [];
    const outcome = await runFill({
      ...deps(setupOf, (_subject, step) => {
        steps.push(step);
      }),
      timing: { ...ROUTE_TIMING, answer: 50 },
    });
    expect(outcome).toEqual({
      status: 'stopped',
      subjectId: A,
      reason: 'cardLoading',
    });
    expect(steps).toEqual(['wait']);
    expect(page.interactions()).toBe(0);
  });

  // The tripwire as the page's own timeline feeds it: one resource entry for each
  // eligibility read and each period check of the replica, under the address the host
  // sends it to, and one for each stray request a case adds, which stands for any other
  // request of the page's own. The count comes from the real tripwire, which leaves the
  // period checks out (owner ruling of 2026-11-26).
  const HOST_API = 'https://regis.reg.kmitl.ac.th/api/';
  const READ_NAME = `${HOST_API}?function=get-pattern-subject-from-subject-id`;
  const PERIOD_NAME = `${HOST_API}?function=check-registration-datetime&level_id=1&year=2569&semester=1`;
  const STRAY_NAME = `${HOST_API}?function=get-student-data`;

  function requests(
    page: Replica,
    before: readonly PerformanceEntry[] = [],
  ): {
    tripwire: FillDeps['tripwire'];
    stray: () => void;
  } {
    let deliver: Callback = () => undefined;
    class Timeline {
      constructor(callback: Callback) {
        deliver = callback;
      }
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    }
    const tripwire = startTripwire(Timeline, {
      entries: () => before,
      clock: () => performance.now(),
    });
    const sent = { reads: 0, polls: 0 };
    const send = (name: string, times: number) => {
      const entries = Array.from({ length: times }, () => resourceEntry(name));
      if (entries.length > 0) deliver({ getEntries: () => entries });
    };
    const sync = () => {
      send(READ_NAME, page.counters.reads - sent.reads);
      send(PERIOD_NAME, page.counters.polls - sent.polls);
      sent.reads = page.counters.reads;
      sent.polls = page.counters.polls;
    };
    return {
      tripwire: {
        count: () => {
          sync();
          return tripwire.count();
        },
        quiet: tripwire.quiet,
        stop: tripwire.stop,
      },
      stray: () => {
        send(STRAY_NAME, 1);
      },
    };
  }

  it.each<[string, FillStep]>([
    ['while the host reads the entered subject', 'wait'],
    ['while the section is chosen', 'choose'],
    ['as Add is pressed', 'add'],
  ])('goes on through a period check %s', async (_name, during) => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 30, catalog: setupOf.catalog });
    const outcome = await runFill({
      ...deps(setupOf, (_subject, step) => {
        if (step === during) page.poll();
      }),
      tripwire: requests(page).tripwire,
    });
    expect(outcome).toEqual({ status: 'done', filled: 1 });
    expect(page.state.list.map((row) => row.section)).toEqual(['1']);
    expect(page.counters).toMatchObject({ polls: 1, reads: 1 });
  });

  it('goes on through a period check at every step of Add all', async () => {
    const setupOf = setup([SINGLE, { ...SINGLE, id: B, day: 3 }]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 30, catalog: setupOf.catalog });
    page.poll();
    const outcome = await runFill({
      ...deps(setupOf, () => {
        page.poll();
      }),
      tripwire: requests(page).tripwire,
    });
    expect(outcome).toEqual({ status: 'done', filled: 2 });
    expect(page.state.list).toHaveLength(2);
    expect(page.counters.reads).toBe(2);
    expect(page.counters.polls).toBeGreaterThan(4);
  });

  it.each<[string, FillStep]>([
    ['while the host reads the entered subject', 'wait'],
    ['while the section is chosen', 'choose'],
  ])(
    'stops on another request of the page %s, and the next press finishes the subject',
    async (_name, during) => {
      const setupOf = setup([SINGLE]);
      const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
      replica = page;
      page.configure({ delay: 30, catalog: setupOf.catalog });
      const timeline = requests(page);
      let strayed = false;
      const first = await runFill({
        ...deps(setupOf, (_subject, step) => {
          if (step === during && !strayed) {
            strayed = true;
            timeline.stray();
          }
        }),
        tripwire: timeline.tripwire,
      });
      expect(first).toMatchObject({
        status: 'stopped',
        subjectId: A,
        reason: 'pageRequest',
      });
      expect(page.state.list).toEqual([]);
      expect(page.counters.clicks.add ?? 0).toBe(0);
      // A fresh press: the subject is still in the field as the page left it, so the run
      // picks it up there and reads nothing again.
      const second = await runFill({
        ...deps(setupOf),
        tripwire: requests(page).tripwire,
      });
      expect(second).toEqual({ status: 'done', filled: 1 });
      expect(page.state.list.map((row) => row.section)).toEqual(['1']);
      expect(page.counters.reads).toBe(1);
    },
  );

  it('stops on another request after Add, and the next press finds the subject listed', async () => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 30, catalog: setupOf.catalog });
    const timeline = requests(page);
    const first = await runFill({
      ...deps(setupOf, (_subject, step) => {
        if (step === 'add') timeline.stray();
      }),
      tripwire: timeline.tripwire,
    });
    expect(first).toMatchObject({ status: 'stopped', reason: 'pageRequest' });
    expect(page.state.list.map((row) => row.section)).toEqual(['1']);
    expect(
      await runFill({ ...deps(setupOf), tripwire: requests(page).tripwire }),
    ).toEqual({ status: 'done', filled: 0 });
    expect(page.counters.clicks.add).toBe(1);
  });

  it('goes on from the first subject not yet added on the next press', async () => {
    const setupOf = setup([SINGLE, { ...SINGLE, id: B, day: 3 }]);
    const [early, late] = setupOf.targets.map((target) => target.subjectId);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 30, catalog: setupOf.catalog });
    const timeline = requests(page);
    let strayed = false;
    const first = await runFill({
      ...deps(setupOf, (subject, step) => {
        if (subject === late && step === 'wait' && !strayed) {
          strayed = true;
          timeline.stray();
        }
      }),
      tripwire: timeline.tripwire,
    });
    expect(first).toMatchObject({
      status: 'stopped',
      subjectId: late,
      reason: 'pageRequest',
    });
    expect(page.state.list.map((row) => row.subjectId)).toEqual([early]);
    const second = await runFill({
      ...deps(setupOf),
      tripwire: requests(page).tripwire,
    });
    // The listed subject is skipped and the stopped one is finished from the field.
    expect(second).toEqual({ status: 'done', filled: 1 });
    expect(page.state.list.map((row) => row.subjectId)).toEqual([early, late]);
    expect(page.counters.reads).toBe(2);
  });

  // A request that ended just before the press, such as the reads of a panel that mounted
  // again, says the page is busy, and another can end a moment later, counted as the
  // tripwire counts it, at its end.
  function endedAgo(name: string, ms: number): PerformanceEntry {
    // Test only: a plain object standing in for a resource entry, which jsdom lacks.
    return {
      initiatorType: 'xmlhttprequest',
      name,
      responseEnd: performance.now() - ms,
    } as unknown as PerformanceEntry;
  }

  it('waits out a busy page before it first acts, then fills', async () => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 30, catalog: setupOf.catalog });
    const timeline = requests(page, [endedAgo(STRAY_NAME, 10)]);
    setTimeout(timeline.stray, 60);
    const outcome = await runFill({
      ...deps(setupOf),
      tripwire: timeline.tripwire,
      timing: QUIET,
    });
    expect(outcome).toEqual({ status: 'done', filled: 1 });
    expect(page.counters.reads).toBe(1);
  });

  it.each([
    ['no request', []],
    ['a request that ended a while ago', [endedAgo(STRAY_NAME, 500)]],
    ['a period check just now', [endedAgo(PERIOD_NAME, 5)]],
  ])(
    'acts at once on a page with %s before the press',
    async (_name, before) => {
      const setupOf = setup([SINGLE]);
      const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
      replica = page;
      page.configure({ delay: 30, catalog: setupOf.catalog });
      const started = Date.now();
      let entered = Number.POSITIVE_INFINITY;
      const outcome = await runFill({
        ...deps(setupOf, (_subject, step) => {
          if (step === 'enter') entered = Date.now();
        }),
        tripwire: requests(page, before).tripwire,
        timing: { ...QUIET, quiet: 400 },
      });
      expect(outcome).toEqual({ status: 'done', filled: 1 });
      // Well inside the quiet spell, which it did not wait for.
      expect(entered - started).toBeLessThan(200);
    },
  );

  it('still stops on a request that ends after KCP first acts', async () => {
    const setupOf = setup([SINGLE]);
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 400, catalog: setupOf.catalog });
    const timeline = requests(page);
    setTimeout(timeline.stray, 300);
    const outcome = await runFill({
      ...deps(setupOf),
      tripwire: timeline.tripwire,
      timing: QUIET,
    });
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'pageRequest' });
    expect(page.state.list).toEqual([]);
    expect(page.counters.clicks.add ?? 0).toBe(0);
  });

  it('counts a request between two subjects against the next one', async () => {
    const setupOf = setup([SINGLE, { ...SINGLE, id: B, day: 3 }]);
    const late = setupOf.targets[1]?.subjectId;
    const page = mountReplica(document, {}, { route: 'a1e43722', poll: 0 });
    replica = page;
    page.configure({ delay: 30, catalog: setupOf.catalog });
    // A request that ends just after the first subject's last check, before the second
    // subject starts: it may follow KCP's press of Add, so it is never left out.
    let extra = 0;
    const outcome = await runFill({
      ...deps(setupOf),
      tripwire: {
        count: () => {
          const value = page.counters.reads + extra;
          if (page.state.list.length === 1) extra = 1;
          return value;
        },
        quiet: () => true,
        stop: () => undefined,
      },
    });
    expect(outcome).toMatchObject({
      status: 'stopped',
      subjectId: late,
      reason: 'pageRequest',
    });
    expect(page.state.list).toHaveLength(1);
  });
});

// The shipped timing on fake timers: a run waits on the host's answers and on nothing of
// its own (ADR-0078, the timing amendment). The host's eligibility read takes 250 ms; the
// page watch takes its next task from the fake clock too, so each wait shows here as the
// fake time it cost.
describe('runFill timing', () => {
  const READ = 250;
  const fakeTask = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  class Silent {
    observe() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  }

  interface Timed {
    specs: Spec[];
    /** Requests of the page that ended this long before the press, in ms. */
    endedAgo?: number[];
    prerequisites?: string[];
    /** When the student presses Stop, in ms after the press. */
    stopAt?: number;
  }

  async function timed(options: Timed) {
    vi.useFakeTimers();
    let onClick: ((event: Event) => void) | null = null;
    try {
      const { plan, kit, targets, catalog } = setup(options.specs);
      // No credit range, so eight subjects fit.
      const page = mountReplica(document, {
        credits: { min: null, max: null },
      });
      replica = page;
      const subjects = { ...catalog };
      if (options.prerequisites !== undefined) {
        for (const [id, subject] of Object.entries(subjects)) {
          subjects[id] = { ...subject, prerequisites: options.prerequisites };
        }
      }
      page.configure({ delay: READ, catalog: subjects });
      const started = Date.now();
      const steps: { step: FillStep; at: number }[] = [];
      const acknowledged: number[] = [];
      onClick = (event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('[data-count="acknowledge"]') !== null
        ) {
          acknowledged.push(Date.now() - started);
        }
      };
      document.addEventListener('click', onClick, true);
      let shownAt: number | null = null;
      let stopped = false;
      if (options.stopAt !== undefined) {
        setTimeout(() => {
          stopped = true;
        }, options.stopAt);
      }
      const before = (options.endedAgo ?? []).map(
        (ago) =>
          // Test only: a plain object standing in for a resource entry, which jsdom lacks.
          ({
            initiatorType: 'xmlhttprequest',
            name: 'https://regis.reg.kmitl.ac.th/api/?function=get-student-credit',
            responseEnd: started - ago,
          }) as unknown as PerformanceEntry,
      );
      let outcome: Awaited<ReturnType<typeof runFill>> | undefined;
      void runFill({
        doc: document,
        plan,
        kit,
        targets,
        allowFull: new Set(),
        stopRequested: () => stopped,
        onStep: (_subject, step) => {
          steps.push({ step, at: Date.now() - started });
          // KCP's card shows the condition as the step announces it.
          if (step === 'conditional') shownAt = Date.now();
        },
        onRefusal: () => undefined,
        conditionShownSince: () => shownAt,
        tripwire: startTripwire(Silent, {
          entries: () => before,
          clock: () => Date.now(),
        }),
        timing: FILL_TIMING,
        watchPage: (doc) => watchPage(doc, fakeTask),
      }).then((result) => {
        outcome = result;
      });
      while (outcome === undefined && Date.now() - started < 120_000) {
        await vi.advanceTimersByTimeAsync(1);
      }
      return { outcome, elapsed: Date.now() - started, steps, acknowledged };
    } finally {
      if (onClick !== null)
        document.removeEventListener('click', onClick, true);
      vi.useRealTimers();
    }
  }

  // Eight subjects on six weekdays, the last two later in the day, so none clash.
  const EIGHT: Spec[] = Array.from({ length: 8 }, (_, index) => ({
    id: `0150000${String(index)}`,
    sections: [['1', 'lecture', null]],
    planned: ['1'],
    day: index,
    start: index < 6 ? 540 : 660,
  }));

  it('adds eight subjects in the time of the host reads alone', async () => {
    const { outcome, elapsed, steps } = await timed({ specs: EIGHT });
    expect(outcome).toEqual({ status: 'done', filled: 8 });
    expect(replica?.state.list).toHaveLength(8);
    expect(elapsed).toBeGreaterThanOrEqual(8 * READ);
    // No pace, no fixed wait, and no wait for a quiet page that made no request.
    expect(elapsed).toBeLessThan(8 * READ + 40);
    expect(steps[0]).toEqual({ step: 'enter', at: 0 });
  });

  it('pays the quiet wait once, when the page made a request just before', async () => {
    const { outcome, elapsed, steps } = await timed({
      specs: EIGHT.slice(0, 2),
      endedAgo: [10],
    });
    expect(outcome).toEqual({ status: 'done', filled: 2 });
    const entered = steps.filter((item) => item.step === 'enter');
    expect(entered[0]?.at).toBeGreaterThanOrEqual(FILL_TIMING.quiet);
    expect(entered[0]?.at).toBeLessThan(
      FILL_TIMING.quiet + FILL_TIMING.poll + 10,
    );
    // The second subject starts as soon as the first is on the list.
    expect(elapsed - (entered[0]?.at ?? 0)).toBeLessThan(2 * READ + 20);
  });

  it('does not wait for a request that ended well before the press', async () => {
    const { outcome, steps } = await timed({
      specs: EIGHT.slice(0, 1),
      endedAgo: [FILL_TIMING.quiet + 1],
    });
    expect(outcome).toEqual({ status: 'done', filled: 1 });
    expect(steps[0]).toEqual({ step: 'enter', at: 0 });
  });

  it('acknowledges the grade dialog the moment the condition has shown for the least time', async () => {
    const { outcome, steps, acknowledged } = await timed({
      specs: EIGHT.slice(0, 1),
      prerequisites: ['01476105'],
    });
    expect(outcome).toEqual({ status: 'done', filled: 1 });
    const shown = steps.find((item) => item.step === 'conditional')?.at ?? 0;
    expect(shown).toBeGreaterThanOrEqual(READ);
    expect(acknowledged).toHaveLength(1);
    expect((acknowledged[0] ?? 0) - shown).toBeGreaterThanOrEqual(
      FILL_TIMING.acknowledge,
    );
    expect((acknowledged[0] ?? 0) - shown).toBeLessThan(
      FILL_TIMING.acknowledge + 10,
    );
  });

  it('reads a Stop press within one poll while the host still reads', async () => {
    const { outcome, elapsed } = await timed({
      specs: [{ ...SINGLE }],
      stopAt: 120,
    });
    expect(outcome).toMatchObject({ status: 'stopped', reason: 'stopped' });
    expect(elapsed).toBeLessThan(120 + FILL_TIMING.poll + 10);
    expect(replica?.counters.clicks).toEqual({});
  });
});
