import { describe, expect, it, vi } from 'vitest';
import type { RequestMessage } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { err, networkError, ok } from '@/lib/utils/result';
import { toSnapshot } from '@/lib/planner/transaction';
import {
  makeCourse,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { prepareRegistrationKit, type PrepareDeps } from './prepareKit';

const A = makeCourse({
  subjectId: 'A',
  sections: [makeSection({ teachTableId: 'A1', subjectId: 'A' })],
});
const B = makeCourse({
  subjectId: 'B',
  sections: [
    makeSection({
      teachTableId: 'B1',
      subjectId: 'B',
      meetings: [],
    }),
  ],
});
const plan = makePlan({
  entries: [
    makePlanEntry({ snapshot: toSnapshot(B, B.sections[0] ?? makeSection()) }),
    makePlanEntry({ snapshot: toSnapshot(A, A.sections[0] ?? makeSection()) }),
  ],
});

function fakeSend(failFor: string[] = []) {
  const sent: RequestMessage[] = [];
  const send = vi.fn((message: RequestMessage) => {
    sent.push(message);
    if (message.type !== 'teachTable/query') {
      return Promise.resolve(ok(undefined));
    }
    const id =
      message.query.mode === 'by_subject_id'
        ? message.query.selected_subject_id
        : '';
    if (failFor.includes(id)) return Promise.resolve(err(networkError('down')));
    const course = id === 'A' ? A : B;
    return Promise.resolve(
      ok({
        catalog: {
          courses: [course],
          duplicateCount: 0,
          multiMeetingCount: 0,
          warnings: [],
        },
        fetchedAt: 0,
      }),
    );
  });
  // Test only assertion: the fake answers every message the code under test sends.
  return { send: send as unknown as TypedSend, sent };
}

function deps(overrides: Partial<PrepareDeps> = {}): PrepareDeps {
  return {
    send: fakeSend().send,
    now: () => '2026-11-22T14:10:00.000Z',
    pause: () => Promise.resolve(),
    isQuiet: () => false,
    profileCurriculum: null,
    onProgress: () => undefined,
    ...overrides,
  };
}

describe('prepareRegistrationKit', () => {
  it('reads each planned subject once, in id order, then builds the kit', async () => {
    const { send, sent } = fakeSend();
    const progress: number[] = [];
    const pause = vi.fn(() => Promise.resolve());
    const outcome = await prepareRegistrationKit(
      plan,
      deps({ send, pause, onProgress: (done) => progress.push(done) }),
    ).result;
    expect(
      sent.map((message) =>
        message.type === 'teachTable/query' &&
        message.query.mode === 'by_subject_id'
          ? message.query.selected_subject_id
          : message.type,
      ),
    ).toEqual(['A', 'B']);
    expect(
      sent.every(
        (message) =>
          message.type !== 'teachTable/query' || message.noRetry === true,
      ),
    ).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([0, 1, 2]);
    expect(outcome.status).toBe('done');
    if (outcome.status === 'done') {
      expect(outcome.kit.subjects.map((subject) => subject.plannedIds)).toEqual(
        [['A1'], ['B1']],
      );
    }
  });

  it('sends nothing on a registration page', async () => {
    const { send, sent } = fakeSend();
    const outcome = await prepareRegistrationKit(
      plan,
      deps({ send, isQuiet: () => true }),
    ).result;
    expect(outcome.status).toBe('refused');
    expect(sent).toEqual([]);
  });

  it('records a failed read and fails only when every read failed', async () => {
    const partial = await prepareRegistrationKit(
      plan,
      deps({ send: fakeSend(['A']).send }),
    ).result;
    expect(partial.status === 'done' && partial.kit.unread).toEqual(['A']);
    const none = await prepareRegistrationKit(
      plan,
      deps({ send: fakeSend(['A', 'B']).send }),
    ).result;
    expect(none.status).toBe('failed');
  });

  it('stops on cancel and aborts the read in flight', async () => {
    const { send, sent } = fakeSend();
    let release: () => void = () => undefined;
    const pause = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const handle = prepareRegistrationKit(plan, deps({ send, pause }));
    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    handle.cancel();
    release();
    expect((await handle.result).status).toBe('cancelled');
    expect(
      sent.filter((message) => message.type === 'teachTable/query'),
    ).toHaveLength(1);
  });
});
