import { describe, expect, it } from 'vitest';
import { createAuditInterceptor } from './audit';
import type { DataQualityReport } from '../../contract/report';
import { loadFixture } from '../../../../tests/support/fixtures';

function collector() {
  let report: DataQualityReport | null = null;
  const audit = createAuditInterceptor({
    extensionVersion: '0.0.0',
    now: () => 'T',
    onReport: (value) => {
      report = value;
    },
  });
  return { audit, get: () => report };
}

describe('createAuditInterceptor', () => {
  it('runs the teach table auditor and stores the report', () => {
    const { audit, get } = collector();
    const fixture = loadFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    audit.observe(
      {
        endpoint: 'get-teach-table-show',
        params: { mode: 'x' },
        url: 'u',
        timeoutMs: 15_000,
      },
      fixture,
    );
    const report = get();
    expect(report?.totals.rows).toBeGreaterThan(0);
    expect(report?.request.endpoint).toBe('get-teach-table-show');
  });

  it('runs the reference auditor for a reference endpoint', () => {
    const { audit, get } = collector();
    const fixture = loadFixture('faculty.capture.json');
    audit.observe(
      { endpoint: 'get-faculty', params: {}, url: 'u', timeoutMs: 15_000 },
      fixture,
    );
    expect(get()?.totals.rows).toBeGreaterThan(0);
  });
});
