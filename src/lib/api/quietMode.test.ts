import { describe, expect, it, vi } from 'vitest';
import type { RequestMessage } from '../messaging/protocol';
import type { TypedSend } from '../messaging/sendTyped';
import { ok } from '../utils/result';
import {
  automaticReferenceRead,
  quietAwareSend,
  withoutRetry,
} from './quietMode';

const query = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '2',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '01076001',
} as const;

describe('withoutRetry', () => {
  it('turns retries off for every request that can reach the network', () => {
    const network: RequestMessage[] = [
      { type: 'ref/faculty' },
      { type: 'ref/department' },
      { type: 'ref/curriculum' },
      { type: 'ref/subjectOwner' },
      { type: 'ref/currentTerm', refresh: true },
      { type: 'teachTable/query', query },
    ];
    for (const message of network) {
      expect(withoutRetry(message)).toEqual({ ...message, noRetry: true });
    }
  });

  it('leaves a message that never reaches the network as it is', () => {
    const local: RequestMessage[] = [
      { type: 'teachTable/cancel', query },
      { type: 'shell/mounted' },
      { type: 'onboarding/claimWelcome' },
      { type: 'debug/clearCache' },
    ];
    for (const message of local) {
      expect(withoutRetry(message)).toBe(message);
    }
  });
});

describe('quietAwareSend', () => {
  it('reads the page at each send, so leaving it restores retries', async () => {
    const inner = vi.fn(() => Promise.resolve(ok([])));
    let quiet = true;
    // A mock cannot satisfy the generic send signature, so it is cast once here.
    const send = quietAwareSend(inner as unknown as TypedSend, () => quiet);
    await send({ type: 'teachTable/query', query });
    quiet = false;
    await send({ type: 'teachTable/query', query });
    expect(inner).toHaveBeenNthCalledWith(1, {
      type: 'teachTable/query',
      query,
      noRetry: true,
    });
    expect(inner).toHaveBeenNthCalledWith(2, {
      type: 'teachTable/query',
      query,
    });
  });
});

describe('automaticReferenceRead', () => {
  it('reads the cache alone while the page is quiet', () => {
    expect(automaticReferenceRead({ type: 'ref/faculty' }, true)).toEqual({
      type: 'ref/faculty',
      cacheOnly: true,
    });
  });

  it('leaves the read as it is on any other page', () => {
    const message = { type: 'ref/currentTerm' } as const;
    expect(automaticReferenceRead(message, false)).toBe(message);
  });
});
