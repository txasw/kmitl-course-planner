import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  httpError,
  networkError,
  storageError,
  timeoutError,
  unknownError,
  validationError,
} from '@/lib/utils/result';
import { errorAction, errorMessageKey } from './errorMessage';

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

describe('errorAction', () => {
  it('edits the subject id for a 400 naming the subject id', () => {
    expect(errorAction(httpError(400, 'rejected', rejection.message))).toBe(
      'editSubjectId',
    );
  });

  it('edits the search for any other 400 and for a 404', () => {
    expect(errorAction(httpError(400, 'rejected'))).toBe('editSearch');
    expect(
      errorAction(httpError(400, 'rejected', { selected_faculty: ['bad'] })),
    ).toBe('editSearch');
    expect(errorAction(httpError(404, 'missing'))).toBe('editSearch');
  });

  it('keeps the retry for a failure a later attempt may clear', () => {
    for (const status of [403, 408, 429, 500, 503]) {
      expect(errorAction(httpError(status, 'failed'))).toBe('retry');
    }
    expect(errorAction(networkError('x'))).toBe('retry');
    expect(errorAction(timeoutError('x'))).toBe('retry');
    expect(errorAction(validationError([]))).toBe('retry');
    expect(errorAction(storageError('x'))).toBe('retry');
    expect(errorAction(unknownError('x'))).toBe('retry');
  });

  it('does not read a subject id field on a status other than 400', () => {
    expect(errorAction(httpError(404, 'missing', rejection.message))).toBe(
      'editSearch',
    );
    expect(errorAction(httpError(500, 'server', rejection.message))).toBe(
      'retry',
    );
  });
});
