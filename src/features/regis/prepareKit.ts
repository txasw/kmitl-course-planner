// The prepare action (ADR-0076): on the student's press, read each planned subject once
// through the gateway by subject id, one at a time with a short pause between reads and
// no retry, then build and save the kit. It runs at a calm time: on the registration
// pages it is refused before anything is sent, since those pages carry the registrar's
// heaviest load, except the helper's own press on pre registration (prepareRefused). A
// cancel stops between reads and aborts the read in flight
// through the worker; a cancelled run and a run whose every read failed keep the
// previous kit.

import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { Plan } from '@/lib/domain/plan';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { withoutRetry } from '@/lib/regis/quietMode';
import { buildRegistrationKit, subjectQuery } from '@/lib/regis/kit';
import type { RegistrationKit } from '@/lib/regis/kitSchema';

/** The pause between two reads, so a plan of many subjects never arrives as a burst. */
export const PREPARE_PAUSE_MS = 600;

export interface PrepareDeps {
  send: TypedSend;
  now: () => string;
  pause: (ms: number) => Promise<void>;
  /** Whether the host page on screen refuses prepare right now. */
  isQuiet: () => boolean;
  profileCurriculum: string | null;
  onProgress: (done: number, total: number) => void;
}

export type PrepareOutcome =
  | { status: 'done'; kit: RegistrationKit }
  | { status: 'refused' }
  | { status: 'cancelled' }
  | { status: 'failed' };

export interface PrepareHandle {
  result: Promise<PrepareOutcome>;
  cancel: () => void;
}

function subjectIds(plan: Plan): string[] {
  return [...new Set(plan.entries.map((entry) => entry.subjectId))].sort(
    (a, b) => a.localeCompare(b, 'en', { numeric: true }),
  );
}

export function prepareRegistrationKit(
  plan: Plan,
  deps: PrepareDeps,
): PrepareHandle {
  const state: { cancelled: boolean; inFlight: TeachTableQuery | null } = {
    cancelled: false,
    inFlight: null,
  };
  // Read through a call, so a check after an await sees the flag as it stands then.
  const isCancelled = (): boolean => state.cancelled;

  async function run(): Promise<PrepareOutcome> {
    if (deps.isQuiet()) return { status: 'refused' };
    const ids = subjectIds(plan);
    const term = { year: plan.year, semester: plan.semester };
    const results = new Map<string, NormalizedCatalog | null>();
    deps.onProgress(0, ids.length);
    for (const [index, subjectId] of ids.entries()) {
      if (index > 0) await deps.pause(PREPARE_PAUSE_MS);
      // The student may have opened a page that refuses prepare while the run paused.
      if (isCancelled()) return { status: 'cancelled' };
      if (deps.isQuiet()) return { status: 'refused' };
      const query = subjectQuery(term, subjectId);
      state.inFlight = query;
      // One read per subject: a failed read is reported as unread rather than retried,
      // so a busy registrar never sees more than one request per subject from a press.
      const result = await deps.send(
        withoutRetry({ type: 'teachTable/query', query }),
      );
      state.inFlight = null;
      if (isCancelled()) return { status: 'cancelled' };
      results.set(subjectId, result.ok ? result.value.catalog : null);
      deps.onProgress(index + 1, ids.length);
    }
    if (
      ids.length > 0 &&
      [...results.values()].every((item) => item === null)
    ) {
      return { status: 'failed' };
    }
    return {
      status: 'done',
      kit: buildRegistrationKit({
        plan,
        results,
        preparedAt: deps.now(),
        profileCurriculum: deps.profileCurriculum,
      }),
    };
  }

  return {
    result: run(),
    cancel: () => {
      state.cancelled = true;
      if (state.inFlight !== null) {
        void deps.send({ type: 'teachTable/cancel', query: state.inFlight });
      }
    },
  };
}
