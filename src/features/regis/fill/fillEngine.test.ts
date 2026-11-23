import { afterEach, describe, expect, it } from 'vitest';
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
import { runFill, type FillDeps, type FillStep } from './fillEngine';

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
              startMin: 540,
              endMin: 600,
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
  const targets = deriveChecklist({ plan, kit, marks: null, pageTerm: null })
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
    },
    onRefusal: () => {
      refusals += 1;
    },
    tripwire: { count: () => 0, stop: () => undefined },
    timing: { pace: 0, poll: 2, answer: 150, settle: 150, acknowledge: 0 },
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
      tripwire: { count: () => 0, stop: () => undefined },
      timing: { pace: 0, poll: 2, answer: 150, settle: 150, acknowledge: 0 },
    });
    relabel.disconnect();
    expect(outcome).toMatchObject({
      status: 'stopped',
      reason: 'notRecognised',
    });
    expect(replica.state.list).toEqual([]);
    expect(replica.counters.clicks.add ?? 0).toBe(0);
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
      tripwire: { count: () => seen, stop: () => undefined },
      timing: { pace: 0, poll: 2, answer: 150, settle: 150, acknowledge: 0 },
    });
    expect(outcome).toMatchObject({
      status: 'stopped',
      reason: 'notRecognised',
    });
    expect(replica.state.list).toEqual([]);
  });
});
