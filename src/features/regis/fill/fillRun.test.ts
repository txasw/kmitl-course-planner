import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mountReplica,
  type Replica,
} from '../../../../tests/e2e/host/pre_registration/replica.js';
import type { Plan } from '@/lib/domain/plan';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { DEFAULT_FILL_SETTINGS } from '@/lib/storage/regis';
import { regisStore } from '../regisStore';
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
});
