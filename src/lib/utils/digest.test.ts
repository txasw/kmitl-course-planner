import { describe, expect, it } from 'vitest';
import { opaqueDigest } from './digest';

const HREF =
  'https://regis.reg.kmitl.ac.th/#/google_oauth_handling?token=SECRET&student_id=65010001';

describe('opaqueDigest', () => {
  it('gives the same text the same digest under one seed', () => {
    expect(opaqueDigest(HREF, 7)).toBe(opaqueDigest(HREF, 7));
  });

  it('tells apart texts that differ in one character', () => {
    expect(opaqueDigest(HREF, 7)).not.toBe(
      opaqueDigest(HREF.replace('65010001', '65010002'), 7),
    );
  });

  it('changes with the seed', () => {
    expect(opaqueDigest(HREF, 7)).not.toBe(opaqueDigest(HREF, 8));
  });

  it('carries no part of the text', () => {
    const digest = opaqueDigest(HREF, 7);
    expect(digest).toMatch(/^[0-9a-z]{1,11}$/);
    expect(digest).not.toContain('SECRET');
    expect(digest).not.toContain('65010001');
  });
});
