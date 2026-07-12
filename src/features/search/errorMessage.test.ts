import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  httpError,
  networkError,
  timeoutError,
  validationError,
} from '@/lib/utils/result';
import { errorMessageKey } from './errorMessage';

// The exact 400 body the registration server returns for a subject id whose length
// is not eight. The cast names the shape the test reads from the untrusted fixture.
const rejection = loadFixture(
  'regressions/teach-table.subject-id-length.error.json',
) as { message: Record<string, string[]> };

describe('errorMessageKey', () => {
  it('maps a subject id length 400 to the specific message', () => {
    expect(errorMessageKey(httpError(400, 'rejected', rejection.message))).toBe(
      'error.subjectIdLength',
    );
  });

  it('falls back to the generic http message for other http errors', () => {
    expect(errorMessageKey(httpError(400, 'rejected'))).toBe('error.http');
    expect(
      errorMessageKey(
        httpError(400, 'rejected', { selected_faculty: ['bad'] }),
      ),
    ).toBe('error.http');
    expect(errorMessageKey(httpError(500, 'server'))).toBe('error.http');
  });

  it('maps the other error kinds to their message', () => {
    expect(errorMessageKey(networkError('x'))).toBe('error.network');
    expect(errorMessageKey(timeoutError('x'))).toBe('error.timeout');
    expect(errorMessageKey(validationError([]))).toBe('error.validation');
  });
});
