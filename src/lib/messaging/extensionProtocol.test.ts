import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DataQualityReport } from '../contract/report';
import type { Result } from '../utils/result';
import { requestMessageSchema, type ResponseMap } from './extensionProtocol';

describe('requestMessageSchema', () => {
  it('accepts a core message', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'ref/faculty', refresh: true })
        .success,
    ).toBe(true);
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

  it('rejects a debug control whose id is missing', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'debug/setFault' }).success,
    ).toBe(false);
  });

  it('answers the report request with the report or null', () => {
    expectTypeOf<ResponseMap['debug/getReport']>().toEqualTypeOf<
      Result<DataQualityReport | null>
    >();
  });
});
