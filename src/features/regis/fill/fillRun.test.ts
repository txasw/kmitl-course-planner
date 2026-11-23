import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mountReplica,
  type Replica,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import type { Plan } from '@/lib/domain/plan';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { DEFAULT_FILL_SETTINGS } from '@/lib/storage/regis';
import { regisStore } from '../regisStore';
import { runFill, type FillDeps } from './fillEngine';
import { fillStore, startFill } from './fillRun';
import { issueStudentPress } from './studentPress';

// The run gate: a run starts only from an unused student press, on the tested host
// build, with no latch for it, and never in a surrogate session. A refused start acts on
// nothing.

// The surrogate presence check reads the page web storage, which only its own module may.
const surrogate = vi.hoisted(() => ({ on: false }));
vi.mock('../host/surrogate', () => ({
  isSurrogateSession: () => surrogate.on,
}));
vi.mock('./fillEngine', async (load) => {
  const actual = await load<typeof import('./fillEngine')>();
  return { ...actual, runFill: vi.fn(actual.runFill) };
});

const TESTED = ['app.454d9e95.js', 'chunk-vendors.7ab4925e.js'];
// Test only: the gate stops the run before any plan or kit field is read.
const PLAN = {} as Plan;
const KIT = {} as RegistrationKit;
const CLICK = { isTrusted: true, detail: 1, timeStamp: 1000 };

let replica: Replica | null = null;

function scripts(names: readonly string[]) {
  for (const name of names) {
    const script = document.createElement('script');
    script.setAttribute('src', `/js/${name}`);
    script.type = 'text/plain';
    document.head.append(script);
  }
}

function press() {
  const issued = issueStudentPress(CLICK, 0, 1100, true);
  if (issued === null) throw new Error('no press');
  return issued;
}

beforeEach(() => {
  vi.mocked(runFill).mockClear();
  replica = mountReplica(document);
  fillStore.setState({ run: { status: 'idle' }, stop: false });
  regisStore.setState({ fill: DEFAULT_FILL_SETTINGS });
});

afterEach(() => {
  expect(replica?.interactions() ?? 0).toBe(0);
  document.head.replaceChildren();
  document.body.replaceChildren();
  surrogate.on = false;
});

const request = { plan: PLAN, kit: KIT, items: [] };

describe('startFill', () => {
  it('refuses an untested host build', async () => {
    scripts(['app.00000000.js', TESTED[1] ?? '']);
    await startFill(press(), request);
    expect(fillStore.getState().run).toMatchObject({
      status: 'stopped',
      reason: 'untestedBuild',
    });
  });

  it('refuses a build an actuator refusal latched', async () => {
    scripts(TESTED);
    regisStore.setState({
      fill: { off: false, latched: [[...TESTED].sort().join(' ')] },
    });
    await startFill(press(), request);
    expect(fillStore.getState().run).toMatchObject({ reason: 'latched' });
  });

  it('starts nothing in a staff surrogate session', async () => {
    scripts(TESTED);
    surrogate.on = true;
    await startFill(press(), request);
    expect(fillStore.getState().run.status).toBe('idle');
  });

  it('runs once per press', async () => {
    scripts(TESTED);
    const once = press();
    await startFill(once, request);
    expect(fillStore.getState().run).toEqual({ status: 'done', filled: 0 });
    fillStore.setState({ run: { status: 'idle' } });
    await startFill(once, request);
    expect(fillStore.getState().run.status).toBe('idle');
  });

  it('starts nothing while the student has switched fill off', async () => {
    scripts(TESTED);
    regisStore.setState({ fill: { off: true, latched: [] } });
    await startFill(press(), request);
    expect(fillStore.getState().run.status).toBe('idle');
    expect(runFill).not.toHaveBeenCalled();
  });

  it('ends a run at the next step once the student switches fill off', async () => {
    scripts(TESTED);
    const seen: boolean[] = [];
    vi.mocked(runFill).mockImplementationOnce((deps: FillDeps) => {
      seen.push(deps.stopRequested());
      regisStore.setState({ fill: { off: true, latched: [] } });
      seen.push(deps.stopRequested());
      return Promise.resolve({
        status: 'stopped',
        subjectId: null,
        reason: 'stopped',
      });
    });
    await startFill(press(), request);
    expect(seen).toEqual([false, true]);
  });

  it('ends a run that faults as a stop, with its tripwire released', async () => {
    scripts(TESTED);
    let released = false;
    vi.mocked(runFill).mockImplementationOnce((deps: FillDeps) => {
      const { stop } = deps.tripwire;
      deps.tripwire.stop = () => {
        released = true;
        stop();
      };
      return Promise.reject(new TypeError('host node vanished'));
    });
    await startFill(press(), request);
    expect(fillStore.getState().run).toMatchObject({
      status: 'stopped',
      reason: 'notRecognised',
    });
    expect(released).toBe(true);
  });
});
