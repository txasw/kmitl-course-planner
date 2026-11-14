import { describe, expect, it } from 'vitest';
import { errorName } from './errorName';

describe('errorName', () => {
  it('reads the name of an error and of a DOMException', () => {
    expect(errorName(new TypeError('bad'))).toBe('TypeError');
    expect(errorName(new DOMException('closed', 'AbortError'))).toBe(
      'AbortError',
    );
  });

  it('reads the name of an error from another realm, which fails instanceof', () => {
    expect(errorName({ name: 'NotAllowedError', message: 'no gesture' })).toBe(
      'NotAllowedError',
    );
  });

  it('is empty for a value with no string name', () => {
    expect(errorName('boom')).toBe('');
    expect(errorName(null)).toBe('');
    expect(errorName(undefined)).toBe('');
    expect(errorName({ name: 42 })).toBe('');
  });
});
