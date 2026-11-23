import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  subscribeHashRoute,
  useHashRoute,
} from '@/features/search/useHashRoute';
import { readLocationHash } from './hostLocation';

// A token after a sign in, and a student id under both names the host uses.
const SECRETS = ['SECRET', '65010001', '64010999'];
const TOKEN_HASH = '#/google_oauth_handling?token=SECRET';
const STUDENT_HASH = '#/report_student?student_id=65010001&std_id=64010999';
const RESULT_HASH =
  '#/teach_table?mode=by_subject_id&selected_year=2569&selected_semester=2&token=SECRET&student_id=65010001&std_id=64010999&search_all_faculty=true&search_all_department=true&search_all_curriculum=true&search_all_class_year=true&selected_subject_id=01076001';

function navigate(hash: string): void {
  window.history.replaceState(null, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function expectNoSecret(value: unknown): void {
  const text = JSON.stringify(value);
  for (const secret of SECRETS) {
    expect(text).not.toContain(secret);
  }
}

afterEach(() => {
  window.history.replaceState(null, '', '#');
});

describe('readLocationHash', () => {
  it.each([TOKEN_HASH, STUDENT_HASH, RESULT_HASH])(
    'keeps nothing of a token or a student id in %s',
    (hash) => {
      window.history.replaceState(null, '', hash);
      expectNoSecret(readLocationHash());
    },
  );

  it('keeps the page and the result search', () => {
    window.history.replaceState(null, '', TOKEN_HASH);
    expect(readLocationHash()).toBe('#/google_oauth_handling');
    window.history.replaceState(null, '', RESULT_HASH);
    expect(readLocationHash()).toMatch(/^#\/teach_table\?mode=by_subject_id&/);
  });
});

describe('the route a subscriber sees', () => {
  it('carries no token or student id through a navigation', () => {
    const seen: string[] = [];
    const stop = subscribeHashRoute(() => {
      seen.push(readLocationHash());
    });
    const { result } = renderHook(() => useHashRoute());
    act(() => {
      navigate(TOKEN_HASH);
    });
    act(() => {
      navigate(STUDENT_HASH);
    });
    act(() => {
      navigate(RESULT_HASH);
    });
    stop();
    expect(seen.length).toBeGreaterThan(0);
    expectNoSecret(seen);
    expectNoSecret(result.current);
    expect(result.current?.params.selected_subject_id).toBe('01076001');
  });
});
