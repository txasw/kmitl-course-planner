import { describe, it, expect } from 'vitest';
import { IS_DEBUG } from './env';

describe('IS_DEBUG', () => {
  it('is a boolean', () => {
    expect(typeof IS_DEBUG).toBe('boolean');
  });

  it('is false under the test build define', () => {
    // vitest.config.ts defines __KCP_DEBUG__ as false, mirroring a production
    // build, so debug only paths are excluded when tests run.
    expect(IS_DEBUG).toBe(false);
  });
});
