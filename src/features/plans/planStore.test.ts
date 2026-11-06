import { describe, it, expect } from 'vitest';
import type { SourceQuery } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { suggestPlans, type Suggestion } from '@/lib/planner/suggest';
import {
  byClassCourses,
  lockSections,
  SUGGEST_QUERY,
  SUGGEST_TERM,
} from '../../../tests/support/suggest';
import { createPlanStore, type PlanStoreDeps } from './planStore';

const SOURCE_QUERY: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: { mode: 'by_class', selected_year: '2569', selected_semester: '1' },
};

const SOURCE_QUERY_S2: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: { mode: 'by_class', selected_year: '2569', selected_semester: '2' },
};

const TERM_S1: Term = { year: '2569', semester: '1' };
const TERM_S2: Term = { year: '2569', semester: '2' };

/** A store with deterministic ids and monotonic timestamps for stable assertions. */
function makeStore(): ReturnType<typeof createPlanStore> {
  let ids = 0;
  let ticks = 0;
  const deps: PlanStoreDeps = {
    uuid: () => {
      ids += 1;
      return `plan-${String(ids)}`;
    },
    now: () => {
      ticks += 1;
      return `2026-01-01T00:00:00.${ticks.toString().padStart(3, '0')}Z`;
    },
  };
  return createPlanStore(deps);
}

function courseFor(section: ReturnType<typeof makeSection>) {
  return makeCourse({ subjectId: section.subjectId, sections: [section] });
}

describe('planStore write side', () => {
  it('adds an addable section', () => {
    const store = makeStore();
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    const outcome = store
      .getState()
      .add(courseFor(section), section, SOURCE_QUERY);
    expect(outcome.ok).toBe(true);
    expect(store.getState().entries).toHaveLength(1);
  });

  it('does not add a section that conflicts with the plan', () => {
    const store = makeStore();
    const first = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    store.getState().add(courseFor(first), first, SOURCE_QUERY);
    const clashing = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    const outcome = store
      .getState()
      .add(courseFor(clashing), clashing, SOURCE_QUERY);
    expect(outcome.ok).toBe(false);
    expect(store.getState().entries).toHaveLength(1);
  });

  it('removes a section, holds it for undo, and restores it', () => {
    const store = makeStore();
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);

    store.getState().remove('a');
    expect(store.getState().entries).toHaveLength(0);
    expect(store.getState().pendingUndo).toMatchObject({
      kind: 'remove',
      added: [],
      removed: [{ teachTableId: 'a' }],
    });

    store.getState().undo();
    expect(store.getState().entries).toHaveLength(1);
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('coalesces consecutive removals and restores them in reverse order', () => {
    const store = makeStore();
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 3 })],
    });
    store.getState().add(courseFor(a), a, SOURCE_QUERY);
    store.getState().add(courseFor(b), b, SOURCE_QUERY);

    store.getState().remove('a');
    store.getState().remove('b');
    // Both removals fold into one undo record rather than the second replacing the first.
    expect(store.getState().entries).toHaveLength(0);
    expect(store.getState().pendingUndo).toMatchObject({
      kind: 'remove',
      removed: [{ teachTableId: 'a' }, { teachTableId: 'b' }],
    });

    store.getState().undo();
    // Both come back, most recent first.
    expect(store.getState().entries.map((entry) => entry.teachTableId)).toEqual(
      ['b', 'a'],
    );
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('clears the pending undo on the next add', () => {
    const store = makeStore();
    const first = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    store.getState().add(courseFor(first), first, SOURCE_QUERY);
    store.getState().remove('a');
    expect(store.getState().pendingUndo).not.toBeNull();

    const next = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 3 })],
    });
    store.getState().add(courseFor(next), next, SOURCE_QUERY);
    expect(store.getState().pendingUndo).toBeNull();
  });
});

describe('planStore multi-plan', () => {
  it('auto-creates a plan for the first add from the source query term', () => {
    const store = makeStore();
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);
    const state = store.getState();
    expect(state.plans).toHaveLength(1);
    expect(state.activePlanId).toBe(state.plans[0]?.id);
    expect(state.plans[0]?.year).toBe('2569');
    expect(state.plans[0]?.semester).toBe('1');
    expect(state.plans[0]?.entries).toHaveLength(1);
  });

  it('leaves no plan behind when the first add is rejected', () => {
    const store = makeStore();
    const pair = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const sibling = makeSection({
      teachTableId: 'b',
      subjectId: 'S1',
      section: '902',
      pairedSection: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    const course = makeCourse({ subjectId: 'S1', sections: [pair, sibling] });
    const outcome = store.getState().add(course, pair, SOURCE_QUERY);
    expect(outcome.ok).toBe(false);
    expect(store.getState().plans).toHaveLength(0);
    expect(store.getState().activePlanId).toBeNull();
  });

  it('creates, renames, and activates plans', () => {
    const store = makeStore();
    const id = store.getState().createPlan('ตาราง 1/2569', TERM_S1);
    expect(store.getState().activePlanId).toBe(id);
    store.getState().renamePlan(id, 'ตารางหลัก');
    expect(store.getState().plans[0]?.name).toBe('ตารางหลัก');
  });

  it('duplicates a plan with independent entries', () => {
    const store = makeStore();
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    const sourceId = store.getState().createPlan('ตาราง 1/2569', TERM_S1);
    store.getState().add(courseFor(section), section, SOURCE_QUERY);
    store.getState().duplicatePlan(sourceId, 'สำเนา');

    const copy = store.getState().plans.find((plan) => plan.name === 'สำเนา');
    expect(copy?.entries).toHaveLength(1);
    expect(store.getState().activePlanId).toBe(copy?.id);

    // Editing the copy does not touch the original.
    store.getState().remove('a');
    const original = store
      .getState()
      .plans.find((plan) => plan.id === sourceId);
    expect(original?.entries).toHaveLength(1);
  });

  it('imports a plan under a fresh id, resets it to unverified, and de-collides the name', () => {
    const store = makeStore();
    const section = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);
    // Give the plan's entries a verified status so the reset to unverified on
    // import is observable.
    const original = store.getState().plans[0];
    if (original === undefined) {
      throw new Error('expected the added plan');
    }
    const source = {
      ...original,
      entries: original.entries.map((entry) => ({
        ...entry,
        verifyStatus: 'verified' as const,
        lastVerifiedAt: '2026-01-01T00:00:00.000Z',
      })),
    };

    const id = store.getState().importPlan(source);
    const state = store.getState();
    expect(state.plans).toHaveLength(2);
    expect(id).not.toBe(original.id);
    expect(state.activePlanId).toBe(id);
    const imported = state.plans.find((plan) => plan.id === id);
    expect(imported?.name).toBe(`${original.name} (2)`);
    expect(
      state.entries.every(
        (entry) =>
          entry.verifyStatus === 'unverified' && entry.lastVerifiedAt === null,
      ),
    ).toBe(true);
  });

  it('keeps two plans of different terms isolated', () => {
    const store = makeStore();
    const planA = store.getState().createPlan('A', TERM_S1);
    const sectionA = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    store.getState().add(courseFor(sectionA), sectionA, SOURCE_QUERY);

    const planB = store.getState().createPlan('B', TERM_S2);
    const sectionB = makeSection({ teachTableId: 'b', subjectId: 'S2' });
    store.getState().add(courseFor(sectionB), sectionB, SOURCE_QUERY_S2);

    store.getState().setActivePlan(planA);
    expect(store.getState().entries.map((entry) => entry.teachTableId)).toEqual(
      ['a'],
    );
    store.getState().setActivePlan(planB);
    expect(store.getState().entries.map((entry) => entry.teachTableId)).toEqual(
      ['b'],
    );
  });

  it('falls back to the most recently updated plan when the active one is deleted', () => {
    const store = makeStore();
    const first = store.getState().createPlan('first', TERM_S1);
    const second = store.getState().createPlan('second', TERM_S2);
    store.getState().deletePlan(second);
    expect(store.getState().activePlanId).toBe(first);
    store.getState().deletePlan(first);
    expect(store.getState().activePlanId).toBeNull();
    expect(store.getState().entries).toHaveLength(0);
  });

  it('hydrates and activates the most recently updated plan', () => {
    const store = makeStore();
    const older = makePlan('old', '2026-01-01T00:00:00.001Z', TERM_S1);
    const newer = makePlan('new', '2026-01-01T00:00:00.900Z', TERM_S2);
    store.getState().hydrate([older, newer]);
    expect(store.getState().activePlanId).toBe('new');
  });
});

describe('planStore load settle', () => {
  it('starts unloaded', () => {
    expect(makeStore().getState().loaded).toBe(false);
  });

  it('marks the load settled on hydrate, even with no plans', () => {
    const store = makeStore();
    store.getState().hydrate([]);
    expect(store.getState().loaded).toBe(true);
  });

  it('marks the load settled without touching the plans', () => {
    const store = makeStore();
    const id = store.getState().createPlan('x', TERM_S1);
    const before = store.getState().plans;
    store.getState().markLoaded();
    expect(store.getState().loaded).toBe(true);
    expect(store.getState().plans).toBe(before);
    expect(store.getState().activePlanId).toBe(id);
  });
});

describe('planStore revalidation write', () => {
  it('applies reconciled entries by durable identity', () => {
    const store = makeStore();
    const section = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);
    const planId = store.getState().activePlanId;
    const current = store.getState().entries[0];
    if (planId === null || current === undefined) {
      throw new Error('expected an active plan with one entry');
    }
    store
      .getState()
      .applyRevalidation(planId, [
        { ...current, verifyStatus: 'verified', lastVerifiedAt: 'T' },
      ]);
    expect(store.getState().entries[0]?.verifyStatus).toBe('verified');
  });

  it('keeps a pending undo when a reconcile does not move a key', () => {
    const store = makeStore();
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    });
    store.getState().add(courseFor(a), a, SOURCE_QUERY);
    store.getState().add(courseFor(b), b, SOURCE_QUERY);
    store.getState().remove('a');
    const planId = store.getState().activePlanId;
    const remaining = store.getState().entries[0];
    if (planId === null || remaining === undefined) {
      throw new Error('expected a remaining entry and an undo');
    }
    store
      .getState()
      .applyRevalidation(planId, [{ ...remaining, verifyStatus: 'verified' }]);
    expect(store.getState().pendingUndo).not.toBeNull();
  });

  it('clears the pending undo when a reconcile moves a key', () => {
    const store = makeStore();
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    });
    store.getState().add(courseFor(a), a, SOURCE_QUERY);
    store.getState().add(courseFor(b), b, SOURCE_QUERY);
    store.getState().remove('a');
    const planId = store.getState().activePlanId;
    const remaining = store.getState().entries[0];
    if (planId === null || remaining === undefined) {
      throw new Error('expected a remaining entry and an undo');
    }
    store
      .getState()
      .applyRevalidation(planId, [{ ...remaining, teachTableId: 'b2' }]);
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('acknowledges a changed entry back to verified', () => {
    const store = makeStore();
    const section = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);
    const planId = store.getState().activePlanId;
    const current = store.getState().entries[0];
    if (planId === null || current === undefined) {
      throw new Error('expected an active plan with one entry');
    }
    store
      .getState()
      .applyRevalidation(planId, [{ ...current, verifyStatus: 'changed' }]);
    expect(store.getState().entries[0]?.verifyStatus).toBe('changed');
    store.getState().acknowledge('a');
    expect(store.getState().entries[0]?.verifyStatus).toBe('verified');
  });

  it('marks an open review as shown without clearing it or touching updatedAt', () => {
    const store = makeStore();
    const section = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    store.getState().add(courseFor(section), section, SOURCE_QUERY);
    const planId = store.getState().activePlanId;
    const current = store.getState().entries[0];
    if (planId === null || current === undefined) {
      throw new Error('expected an active plan with one entry');
    }
    const review = {
      kinds: ['room_changed' as const],
      before: current.snapshot,
      detectedAt: '2026-11-01T00:00:00.000Z',
      notifiedAt: null,
    };
    store
      .getState()
      .applyRevalidation(planId, [
        { ...current, verifyStatus: 'changed', review },
      ]);
    const updatedAt = store.getState().plans[0]?.updatedAt;
    store.getState().markNotified(['a']);
    const marked = store.getState().entries[0];
    expect(marked?.review?.kinds).toEqual(['room_changed']);
    expect(marked?.review?.notifiedAt).not.toBeNull();
    expect(store.getState().plans[0]?.entries[0]).toBe(marked);
    expect(store.getState().plans[0]?.updatedAt).toBe(updatedAt);
  });
});

function makePlan(id: string, updatedAt: string, term: Term) {
  return {
    id,
    name: id,
    year: term.year,
    semester: term.semester,
    entries: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('planStore createFromSuggestion', () => {
  const courses = byClassCourses();
  // The student placed the GenEd 04186098 by hand; it is kept as a fixed constraint.
  const locked = lockSections(courses, [['04186098', '2']]);

  function firstSuggestion(): Suggestion {
    const [suggestion] = suggestPlans({
      courses,
      locked,
      objective: 'coverAll',
      preference: 'morning',
    }).suggestions;
    if (suggestion === undefined) {
      throw new Error('expected a suggestion');
    }
    return suggestion;
  }

  function seededStore() {
    const store = makeStore();
    const original = {
      ...makePlan('original', '2026-01-01T00:00:00.000Z', SUGGEST_TERM),
      entries: locked,
    };
    store.getState().hydrate([original]);
    return { store, original };
  }

  it('creates an active plan with the locked entries plus the suggestion', () => {
    const { store, original } = seededStore();
    const suggestion = firstSuggestion();
    const plan = store.getState().createFromSuggestion({
      name: 'ตาราง 1/2569 เน้นเช้า',
      term: SUGGEST_TERM,
      suggestion,
      sourceQuery: SUGGEST_QUERY,
    });

    expect(plan?.name).toBe('ตาราง 1/2569 เน้นเช้า');
    expect(store.getState().activePlanId).toBe(plan?.id);
    const subjects = new Set(
      store.getState().entries.map((entry) => entry.subjectId),
    );
    expect(subjects).toEqual(
      new Set([
        '04186098',
        ...suggestion.choices.map((choice) => choice.course.subjectId),
      ]),
    );
    // The plan it started from is untouched.
    expect(
      store.getState().plans.find((p) => p.id === original.id),
    ).toStrictEqual(original);
    expect(store.getState().pendingUndo).toMatchObject({
      kind: 'create',
      planId: plan?.id,
      previousPlanId: original.id,
    });
  });

  it('undoes by deleting the created plan and restoring the previous one', () => {
    const { store, original } = seededStore();
    store.getState().createFromSuggestion({
      name: 'ตาราง 1/2569',
      term: SUGGEST_TERM,
      suggestion: firstSuggestion(),
      sourceQuery: SUGGEST_QUERY,
    });
    store.getState().undo();

    expect(store.getState().plans).toStrictEqual([original]);
    expect(store.getState().activePlanId).toBe(original.id);
    expect(store.getState().entries).toBe(original.entries);
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('suffixes the name when a plan already uses it', () => {
    const { store } = seededStore();
    const input = {
      name: 'original',
      term: SUGGEST_TERM,
      suggestion: firstSuggestion(),
      sourceQuery: SUGGEST_QUERY,
    };
    expect(store.getState().createFromSuggestion(input)?.name).toBe(
      'original (2)',
    );
  });

  it('keeps no entries of an active plan from another term', () => {
    const store = makeStore();
    store.getState().hydrate([
      {
        ...makePlan('other', '2026-01-01T00:00:00.000Z', TERM_S2),
        entries: [],
      },
    ]);
    const [suggestion] = suggestPlans({
      courses,
      locked: [],
      objective: 'coverAll',
      preference: 'balanced',
    }).suggestions;
    if (suggestion === undefined) {
      throw new Error('expected a suggestion');
    }
    const plan = store.getState().createFromSuggestion({
      name: 'ตาราง 1/2569',
      term: SUGGEST_TERM,
      suggestion,
      sourceQuery: SUGGEST_QUERY,
    });
    expect(plan).toMatchObject({ year: '2569', semester: '1' });
    expect(plan?.entries).toHaveLength(
      suggestion.choices.reduce(
        (count, choice) => count + choice.group.length,
        0,
      ),
    );
  });

  it('changes nothing when the add gate refuses a chosen section', () => {
    const { store, original } = seededStore();
    const suggestion = firstSuggestion();
    // A suggestion searched for another term is refused as cross term.
    const outcome = store.getState().createFromSuggestion({
      name: 'ตาราง 2/2569',
      term: TERM_S2,
      suggestion,
      sourceQuery: SUGGEST_QUERY,
    });
    expect(outcome).toBeNull();
    expect(store.getState().plans).toStrictEqual([original]);
    expect(store.getState().pendingUndo).toBeNull();
  });
});
