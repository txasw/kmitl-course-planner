import { describe, expect, it } from 'vitest';
import {
  HOST_MATCH_PATTERNS,
  HOST_ORIGINS,
  REGIS_MATCH_PATTERN,
  SELECTOR_URL,
} from './hostTab';

describe('host tab constants', () => {
  it('names the host search page exactly, with no query string', () => {
    expect(SELECTOR_URL).toBe(
      'https://regis.reg.kmitl.ac.th/#/teach_table_selector',
    );
    const url = new URL(SELECTOR_URL);
    expect(url.search).toBe('');
    expect(url.pathname).toBe('/');
    expect(url.hash).toBe('#/teach_table_selector');
  });

  it('keeps the host permissions the manifest has always declared', () => {
    expect(HOST_MATCH_PATTERNS).toEqual([
      'https://regis.reg.kmitl.ac.th/*',
      'https://api.reg.kmitl.ac.th/*',
    ]);
  });

  it('holds bare https origins with no path', () => {
    for (const origin of HOST_ORIGINS) {
      expect(new URL(origin).origin).toBe(origin);
      expect(origin.startsWith('https://')).toBe(true);
    }
  });

  it('runs the content script on the registration site only', () => {
    expect(REGIS_MATCH_PATTERN).toBe('https://regis.reg.kmitl.ac.th/*');
    expect(HOST_MATCH_PATTERNS).toContain(REGIS_MATCH_PATTERN);
  });
});
