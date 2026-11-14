import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { TeachTableResult } from '../api/types';
import {
  httpError,
  networkError,
  storageError,
  timeoutError,
  unknownError,
  validationError,
  type ApiError,
  type Result,
} from '../utils/result';
import {
  claimWelcomeReplySchema,
  mountedReplySchema,
  requestMessageSchema,
  resultEnvelopeSchema,
  teachTableQuerySchema,
  type ResponseMap,
} from './protocol';

const byClassQuery = {
  mode: 'by_class',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  selected_department: '08',
  selected_curriculum: '08',
  selected_class_year: '4',
  search_all_faculty: false,
  search_all_department: false,
  search_all_curriculum: false,
  search_all_class_year: false,
};

describe('teachTableQuerySchema', () => {
  it('accepts each search mode', () => {
    expect(teachTableQuerySchema.safeParse(byClassQuery).success).toBe(true);
    expect(
      teachTableQuerySchema.safeParse({
        ...byClassQuery,
        mode: 'by_subject_id',
        selected_subject_id: '90592033',
      }).success,
    ).toBe(true);
    expect(
      teachTableQuerySchema.safeParse({
        mode: 'by_subject_owner_id',
        selected_year: '2569',
        selected_semester: '1',
        selected_faculty: '01',
        search_all_faculty: true,
        selected_subject_owner_id: '32',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown mode', () => {
    expect(
      teachTableQuerySchema.safeParse({ ...byClassQuery, mode: 'by_year' })
        .success,
    ).toBe(false);
  });

  it('rejects a by_subject_id query missing its subject id', () => {
    expect(
      teachTableQuerySchema.safeParse({
        ...byClassQuery,
        mode: 'by_subject_id',
      }).success,
    ).toBe(false);
  });

  it('rejects a string where a search flag must be boolean', () => {
    expect(
      teachTableQuerySchema.safeParse({
        ...byClassQuery,
        search_all_faculty: 'true',
      }).success,
    ).toBe(false);
  });
});

describe('requestMessageSchema', () => {
  it('accepts a reference request with and without refresh', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'ref/faculty' }).success,
    ).toBe(true);
    expect(
      requestMessageSchema.safeParse({ type: 'ref/faculty', refresh: true })
        .success,
    ).toBe(true);
    expect(
      requestMessageSchema.safeParse({ type: 'ref/currentTerm' }).success,
    ).toBe(true);
  });

  it('accepts a teach table query message', () => {
    expect(
      requestMessageSchema.safeParse({
        type: 'teachTable/query',
        query: byClassQuery,
      }).success,
    ).toBe(true);
  });

  it('rejects a teach table message whose nested query is invalid', () => {
    expect(
      requestMessageSchema.safeParse({
        type: 'teachTable/query',
        query: { ...byClassQuery, mode: 'nope' },
      }).success,
    ).toBe(false);
  });

  it('accepts the debug simulation controls with a null id', () => {
    expect(
      requestMessageSchema.safeParse({
        type: 'debug/setFixture',
        fixtureId: null,
      }).success,
    ).toBe(true);
    expect(
      requestMessageSchema.safeParse({ type: 'debug/getRequestLog' }).success,
    ).toBe(true);
  });

  it('accepts the mount handshake with no payload', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'shell/mounted' }).success,
    ).toBe(true);
  });

  it('accepts the welcome claim with no payload', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'onboarding/claimWelcome' })
        .success,
    ).toBe(true);
  });

  it('rejects an unknown message type and a non object', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'ref/unknown' }).success,
    ).toBe(false);
    expect(requestMessageSchema.safeParse('nope').success).toBe(false);
    expect(requestMessageSchema.safeParse(null).success).toBe(false);
  });
});

describe('mountedReplySchema', () => {
  it('accepts a successful handshake with and without a shortcut', () => {
    for (const shortcut of ['Alt+Shift+P', null]) {
      expect(
        mountedReplySchema.safeParse({
          ok: true,
          value: { openPanel: true, shortcut },
        }).success,
      ).toBe(true);
    }
  });

  it('rejects an error result and a malformed reply', () => {
    for (const reply of [
      { ok: false, error: { kind: 'network', message: 'down' } },
      { ok: true, value: { openPanel: 'yes', shortcut: null } },
      { ok: true, value: { openPanel: true } },
      undefined,
      null,
    ]) {
      expect(mountedReplySchema.safeParse(reply).success).toBe(false);
    }
  });
});

describe('claimWelcomeReplySchema', () => {
  it('accepts a grant and a denial', () => {
    for (const granted of [true, false]) {
      expect(
        claimWelcomeReplySchema.safeParse({ ok: true, value: { granted } })
          .success,
      ).toBe(true);
    }
  });

  it('rejects an error result and a malformed reply', () => {
    for (const reply of [
      { ok: false, error: { kind: 'network', message: 'down' } },
      { ok: true, value: { granted: 'yes' } },
      { ok: true, value: {} },
      undefined,
    ]) {
      expect(claimWelcomeReplySchema.safeParse(reply).success).toBe(false);
    }
  });
});

describe('resultEnvelopeSchema', () => {
  it('covers exactly the kinds of the sealed error taxonomy', () => {
    // A kind added to ApiError but not to the schema would turn every such error
    // into a malformed reply, so the two sets must stay equal.
    type EnvelopeError = Extract<
      z.infer<typeof resultEnvelopeSchema>,
      { ok: false }
    >['error'];
    expectTypeOf<EnvelopeError['kind']>().toEqualTypeOf<ApiError['kind']>();
  });

  it('accepts every error the result constructors build', () => {
    for (const error of [
      networkError('down'),
      timeoutError('slow'),
      httpError(503, 'busy'),
      httpError(400, 'bad', { id: ['short'] }),
      validationError([{ path: 'a', message: 'b' }]),
      storageError('full'),
      unknownError('odd'),
    ]) {
      expect(resultEnvelopeSchema.safeParse({ ok: false, error }).success).toBe(
        true,
      );
    }
  });

  it('rejects an error whose fields drift from the taxonomy', () => {
    for (const error of [
      { kind: 'http', message: 'no status' },
      { kind: 'validation', message: 'no issues' },
      { kind: 'network', message: 3 },
    ]) {
      expect(resultEnvelopeSchema.safeParse({ ok: false, error }).success).toBe(
        false,
      );
    }
  });
});

describe('teach table response', () => {
  it('carries the catalog with its fetch time', () => {
    expectTypeOf<ResponseMap['teachTable/query']>().toEqualTypeOf<
      Result<TeachTableResult>
    >();
  });
});
