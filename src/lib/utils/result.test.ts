import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  networkError,
  timeoutError,
  httpError,
  validationError,
  storageError,
  unknownError,
  type Result,
} from './result';

describe('Result', () => {
  it('wraps a success value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) {
      expect(r.value).toBe(42);
    }
  });

  it('wraps an error value', () => {
    const r: Result<number> = err(networkError('offline'));
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error.kind).toBe('network');
    }
  });
});

describe('error constructors', () => {
  it('builds each error as a tagged plain object', () => {
    expect(networkError('n')).toEqual({ kind: 'network', message: 'n' });
    expect(timeoutError('t')).toEqual({ kind: 'timeout', message: 't' });
    expect(httpError(503, 'unavailable')).toEqual({
      kind: 'http',
      status: 503,
      message: 'unavailable',
    });
    expect(storageError('s')).toEqual({ kind: 'storage', message: 's' });
    expect(unknownError('u')).toEqual({ kind: 'unknown', message: 'u' });
  });

  it('builds a validation error with issues and a default message', () => {
    const issues = [
      { path: 'rows[0].teach_time', message: 'expected HH:MM:SS' },
    ];
    const e = validationError(issues);
    expect(e.kind).toBe('validation');
    expect(e.issues).toEqual(issues);
    expect(e.message).toBe('Response failed schema validation');
  });

  it('accepts a custom validation message', () => {
    expect(validationError([], 'bad plan').message).toBe('bad plan');
  });

  it('produces objects that survive structured clone', () => {
    const e = httpError(500, 'boom');
    expect(structuredClone(e)).toEqual(e);
  });
});
