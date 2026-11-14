import { describe, it, expect, afterEach, vi } from 'vitest';
import { canShareImage, classifyShareError, pngFile } from './imageShare';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canShareImage', () => {
  it('is false where the browser has no Web Share API, as in jsdom', () => {
    expect(canShareImage()).toBe(false);
  });

  it('is false where the browser shares text but no files', () => {
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false });
    expect(canShareImage()).toBe(false);
  });

  it('is false where share exists without canShare to ask', () => {
    vi.stubGlobal('navigator', { share: vi.fn() });
    expect(canShareImage()).toBe(false);
  });

  it('asks canShare about a PNG file and follows its answer', () => {
    const canShare = vi.fn((data: ShareData) => {
      const file = data.files?.[0];
      return file?.type === 'image/png';
    });
    vi.stubGlobal('navigator', { share: vi.fn(), canShare });
    expect(canShareImage()).toBe(true);
    expect(canShare).toHaveBeenCalledTimes(1);
  });

  it('is false when canShare throws on the probe', () => {
    vi.stubGlobal('navigator', {
      share: vi.fn(),
      canShare: () => {
        throw new TypeError('files unsupported');
      },
    });
    expect(canShareImage()).toBe(false);
  });
});

describe('classifyShareError', () => {
  it('reads a closed share sheet as a cancel', () => {
    expect(classifyShareError(new DOMException('closed', 'AbortError'))).toBe(
      'cancelled',
    );
  });

  it('reads a lost user activation as needing a fresh press', () => {
    expect(
      classifyShareError(new DOMException('no gesture', 'NotAllowedError')),
    ).toBe('needsPress');
  });

  it('reads a refusal raised in another realm by its name', () => {
    expect(classifyShareError({ name: 'AbortError' })).toBe('cancelled');
    expect(classifyShareError({ name: 'NotAllowedError' })).toBe('needsPress');
  });

  it('reads anything else as a failure', () => {
    expect(classifyShareError(new DOMException('bad', 'DataError'))).toBe(
      'failed',
    );
    expect(classifyShareError(new Error('boom'))).toBe('failed');
  });
});

describe('pngFile', () => {
  it('names the image with the export file name and the PNG type', () => {
    const file = pngFile(new Blob(['png']), 'kmitl-plan-share.png');
    expect(file.name).toBe('kmitl-plan-share.png');
    expect(file.type).toBe('image/png');
  });
});
