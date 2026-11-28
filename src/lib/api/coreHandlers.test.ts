import { describe, expect, it, vi } from 'vitest';
import { createCoreHandlers } from './coreHandlers';
import {
  currentTermEndpoint,
  curriculumEndpoint,
  departmentEndpoint,
  facultyEndpoint,
  subjectOwnerEndpoint,
} from './endpoints';
import type { Gateway } from './gateway';
import {
  coreRequestMessageSchema,
  type CoreRequestMessage,
  type CoreResponseMap,
  type TeachTableQuery,
} from '../messaging/protocol';
import { createRouter } from '../messaging/router';
import { err, timeoutError } from '../utils/result';

const RUNTIME_ID = 'kcp-core-id';
const sender = { id: RUNTIME_ID };

const ownerQuery: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  search_all_faculty: false,
  selected_subject_owner_id: '32',
};

// The reference fake answers a failure, which is a valid reply for any list type.
const REFERENCE_REPLY = err(timeoutError('the fake gateway timed out'));

function fakeGateway() {
  // A mock cannot take the generic reference signature, so it records the calls.
  const reference = vi.fn();
  const teachTable = vi.fn<Gateway['teachTable']>(
    () => new Promise(() => undefined),
  );
  const cancelTeachTable = vi.fn<Gateway['cancelTeachTable']>();
  const gateway: Gateway = {
    reference: (endpoint, options) => {
      reference(endpoint, options);
      return Promise.resolve(REFERENCE_REPLY);
    },
    teachTable,
    cancelTeachTable,
  };
  return { gateway, reference, teachTable, cancelTeachTable };
}

function routerOver(gateway: Gateway) {
  return createRouter<CoreRequestMessage, CoreResponseMap>({
    schema: coreRequestMessageSchema,
    handlers: createCoreHandlers(gateway),
    runtimeId: RUNTIME_ID,
  });
}

describe('createCoreHandlers', () => {
  it.each([
    ['ref/faculty', facultyEndpoint],
    ['ref/department', departmentEndpoint],
    ['ref/curriculum', curriculumEndpoint],
    ['ref/subjectOwner', subjectOwnerEndpoint],
    ['ref/currentTerm', currentTermEndpoint],
  ] as const)(
    'reads %s through its endpoint with the message as the options',
    async (type, endpoint) => {
      const { gateway, reference } = fakeGateway();
      const message = { type, refresh: true, cacheOnly: true };
      const result = await routerOver(gateway)(message, sender);
      expect(reference).toHaveBeenCalledWith(endpoint, message);
      expect(result).toBe(REFERENCE_REPLY);
    },
  );

  it('runs a teach table query with the message as the options', () => {
    const { gateway, teachTable } = fakeGateway();
    const message = {
      type: 'teachTable/query',
      query: ownerQuery,
      noRetry: true,
    };
    void routerOver(gateway)(message, sender);
    expect(teachTable).toHaveBeenCalledWith(ownerQuery, message);
  });

  it('cancels a teach table query and answers a void success', async () => {
    const { gateway, cancelTeachTable } = fakeGateway();
    const result = await routerOver(gateway)(
      { type: 'teachTable/cancel', query: ownerQuery },
      sender,
    );
    expect(cancelTeachTable).toHaveBeenCalledWith(ownerQuery);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('handles only the messages that reach the gateway', async () => {
    const { gateway } = fakeGateway();
    expect(Object.keys(createCoreHandlers(gateway)).sort()).toEqual([
      'ref/currentTerm',
      'ref/curriculum',
      'ref/department',
      'ref/faculty',
      'ref/subjectOwner',
      'teachTable/cancel',
      'teachTable/query',
    ]);
    const result = await routerOver(gateway)({ type: 'shell/mounted' }, sender);
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'no handler for shell/mounted' },
    });
  });
});
