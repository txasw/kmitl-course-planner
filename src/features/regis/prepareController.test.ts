import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestMessage } from '@/lib/messaging/extensionProtocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { err, networkError } from '@/lib/utils/result';
import { makePlan } from '../../../tests/support/domain-builders';
import { fillStore } from './fill/fillRun';
import { cancelPrepare, startHelperPrepare } from './prepareController';
import { regisStore } from './regisStore';

// The helper's own Prepare data: it starts only from a trusted press, only on the pre
// registration page, and never while a fill run is active; on the registration page it
// sends nothing. Every read goes through the send it is given, which is the background
// gateway's, with retries off.

const plan = makePlan({ id: 'p1' });
const t = (key: string) => key;

function fakeSend() {
  const sent: RequestMessage[] = [];
  const send = vi.fn((message: RequestMessage) => {
    sent.push(message);
    return Promise.resolve(err(networkError('down')));
  });
  // Test only assertion: the fake answers every message the code under test sends.
  return { send: send as unknown as TypedSend, sent };
}

afterEach(async () => {
  cancelPrepare();
  await vi.waitFor(() => {
    expect(regisStore.getState().run.status).not.toBe('running');
  });
  regisStore.getState().setRun({ status: 'idle' });
  fillStore.setState({ run: { status: 'idle' } });
  window.location.hash = '';
});

describe('startHelperPrepare', () => {
  it('starts nothing for a press the browser did not make', () => {
    window.location.hash = '#/pre_registration';
    const { send, sent } = fakeSend();
    expect(startHelperPrepare({ isTrusted: false }, plan, send, t)).toBe(false);
    expect(sent).toEqual([]);
    expect(regisStore.getState().run.status).toBe('idle');
  });

  it('starts nothing on the registration page or any other registration page', () => {
    const { send, sent } = fakeSend();
    for (const hash of ['#/registration', '#/registration_queue']) {
      window.location.hash = hash;
      expect(startHelperPrepare({ isTrusted: true }, plan, send, t)).toBe(
        false,
      );
    }
    expect(sent).toEqual([]);
  });

  it('starts nothing while a fill run is active', () => {
    window.location.hash = '#/pre_registration';
    fillStore.setState({
      run: {
        status: 'running',
        subjectId: '01476107',
        step: 'enter',
        prerequisites: [],
        done: 0,
        total: 1,
      },
    });
    const { send, sent } = fakeSend();
    expect(startHelperPrepare({ isTrusted: true }, plan, send, t)).toBe(false);
    expect(sent).toEqual([]);
  });

  it('reads each subject once, with no retry, for a trusted press on pre registration', async () => {
    window.location.hash = '#/pre_registration';
    const { send, sent } = fakeSend();
    expect(startHelperPrepare({ isTrusted: true }, plan, send, t)).toBe(true);
    await vi.waitFor(() => {
      expect(regisStore.getState().run.status).toBe('failed');
    });
    const reads = sent.filter((message) => message.type === 'teachTable/query');
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((message) => message.noRetry === true)).toBe(true);
    // The failed outcome is final: nothing is read again until the next press.
    const count = sent.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toHaveLength(count);
  });
});
