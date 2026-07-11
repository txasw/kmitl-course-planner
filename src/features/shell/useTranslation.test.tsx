import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTranslation } from './useTranslation';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  // Reset the shared store so one test does not leak its language into the next.
  act(() => {
    uiStore.getState().setLanguage('th');
  });
});

describe('useTranslation', () => {
  it('translates in the active locale and reacts to a change', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.language).toBe('th');
    expect(result.current.t('launcher.open')).toBe(
      'เปิด Course Planner for KMITL',
    );

    act(() => {
      uiStore.getState().setLanguage('en');
    });

    expect(result.current.language).toBe('en');
    expect(result.current.t('launcher.open')).toBe(
      'Open Course Planner for KMITL',
    );
  });
});
