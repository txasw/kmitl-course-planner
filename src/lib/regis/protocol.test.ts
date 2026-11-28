import { describe, expect, it } from 'vitest';
import { hostBuildReplySchema, hostBuildRequestSchema } from './protocol';

describe('the host check message', () => {
  const pair = {
    type: 'regis/hostBuild',
    app: 'app.c0ffee01.js',
    vendors: 'chunk-vendors.7ab4925e.js',
  };

  it('accepts the two public script names', () => {
    expect(hostBuildRequestSchema.safeParse(pair).success).toBe(true);
  });

  it.each([
    ['an address for the app', { app: 'https://evil.example/app.c0ffee01.js' }],
    ['a path for the app', { app: '../app.c0ffee01.js' }],
    ['a vendor name for the app', { app: 'chunk-vendors.7ab4925e.js' }],
    ['an app name for the vendors', { vendors: 'app.c0ffee01.js' }],
    ['a short hash', { app: 'app.c0ffee.js' }],
  ])('rejects %s', (_name, change) => {
    expect(
      hostBuildRequestSchema.safeParse({ ...pair, ...change }).success,
    ).toBe(false);
  });

  it('checks the reply down to the verdict and its parts', () => {
    expect(
      hostBuildReplySchema.safeParse({
        ok: true,
        value: { status: 'mismatch', parts: ['labels'] },
      }).success,
    ).toBe(true);
    for (const value of [
      { status: 'mismatch', parts: ['nothing'] },
      { status: 'trusted' },
      null,
    ]) {
      expect(hostBuildReplySchema.safeParse({ ok: true, value }).success).toBe(
        false,
      );
    }
  });
});
