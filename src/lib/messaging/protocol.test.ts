import { describe, expect, it } from 'vitest';
import { requestMessageSchema, teachTableQuerySchema } from './protocol';

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

  it('rejects an unknown message type and a non object', () => {
    expect(
      requestMessageSchema.safeParse({ type: 'ref/unknown' }).success,
    ).toBe(false);
    expect(requestMessageSchema.safeParse('nope').success).toBe(false);
    expect(requestMessageSchema.safeParse(null).success).toBe(false);
  });
});
