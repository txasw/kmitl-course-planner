import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { installViewport } from '../../../tests/support/viewport';
import { useLayoutTier } from './useLayoutTier';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useLayoutTier', () => {
  it.each([
    [390, 'compact'],
    [768, 'medium'],
    [1024, 'lg'],
    [1440, 'xl'],
    [1920, '2xl'],
  ] as const)('reports the tier for a %i px viewport', (width, tier) => {
    installViewport(width);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe(tier);
  });

  it('follows the viewport across a tier cut', () => {
    const viewport = installViewport(1023);
    const { result } = renderHook(() => useLayoutTier());
    expect(result.current).toBe('medium');
    act(() => {
      viewport.resize(1024);
    });
    expect(result.current).toBe('lg');
    act(() => {
      viewport.resize(639);
    });
    expect(result.current).toBe('compact');
  });
});
