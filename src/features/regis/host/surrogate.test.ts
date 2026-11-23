import { afterEach, describe, expect, it } from 'vitest';
import { isSurrogateSession } from './surrogate';

afterEach(() => {
  sessionStorage.clear();
});

describe('isSurrogateSession', () => {
  it('checks only whether the surrogate key is present', () => {
    expect(isSurrogateSession()).toBe(false);
    sessionStorage.setItem('surrogated_student_id', '');
    expect(isSurrogateSession()).toBe(true);
  });
});
