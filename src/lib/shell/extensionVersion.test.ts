import { describe, it, expect } from 'vitest';
import { readExtensionVersion } from './extensionVersion';

describe('readExtensionVersion', () => {
  it('returns the manifest version as written', () => {
    expect(readExtensionVersion(() => ({ version: '1.5.0' }))).toBe('1.5.0');
  });

  it('keeps a four part version whole', () => {
    expect(readExtensionVersion(() => ({ version: '1.5.0.2' }))).toBe(
      '1.5.0.2',
    );
  });

  it('yields null for a missing, empty, or non string version', () => {
    expect(readExtensionVersion(() => ({}))).toBeNull();
    expect(readExtensionVersion(() => ({ version: '' }))).toBeNull();
    expect(readExtensionVersion(() => ({ version: 15 }))).toBeNull();
  });

  it('yields null when the runtime throws', () => {
    expect(
      readExtensionVersion(() => {
        throw new Error('Extension context invalidated.');
      }),
    ).toBeNull();
  });
});
