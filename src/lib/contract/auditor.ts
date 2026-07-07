// The contract auditor. After a live response passes the hard Zod gate, the
// auditor walks the raw rows against the expectation table and produces a data
// quality report. It runs only in debug builds and tests, so it observes the same
// data the production normalizer sees without adding cost to production. It embeds
// a canary the production bundle check greps for.

import { FULL_MARKER } from '../domain/schemas';
import {
  SECTION_ROW_EXPECTATIONS,
  SECTION_ROW_FIELDS,
  CROSS_FIELD_RULES,
  type FieldExpectation,
} from './expectations';
import {
  ISSUE_CAP,
  ISSUE_SAMPLE_CAP,
  emptyByKind,
  type ContractIssue,
  type DataQualityReport,
  type IssueAggregate,
  type IssueKind,
  type IssueRowRef,
} from './report';

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface AuditContext {
  extensionVersion: string;
  generatedAt: string;
  request: { endpoint: string; params: Record<string, string> };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenTeachTableRows(response: unknown): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  if (!Array.isArray(response)) {
    return rows;
  }
  for (const group of response) {
    if (!isRecord(group) || !Array.isArray(group.teachtable)) {
      continue;
    }
    for (const block of group.teachtable) {
      if (!isRecord(block) || !Array.isArray(block.data)) {
        continue;
      }
      for (const row of block.data) {
        if (isRecord(row)) {
          rows.push(row);
        }
      }
    }
  }
  return rows;
}

function collectRecords(value: unknown): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  if (!Array.isArray(value)) {
    return rows;
  }
  for (const item of value) {
    if (isRecord(item)) {
      rows.push(item);
    }
  }
  return rows;
}

function clampReceived(value: unknown): string {
  let text: string;
  if (value === undefined) {
    text = 'undefined';
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    // value is string, null, or an object here, so JSON.stringify returns a string.
    text = JSON.stringify(value);
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function toRowRef(row: Record<string, unknown>, index: number): IssueRowRef {
  const ref: IssueRowRef = { index };
  if (typeof row.teach_table_id === 'string') {
    ref.teachTableId = row.teach_table_id;
  }
  if (typeof row.subject_id === 'string') {
    ref.subjectId = row.subject_id;
  }
  return ref;
}

function issue(
  kind: IssueKind,
  severity: ContractIssue['severity'],
  path: string,
  expected: string,
  received: string,
  rowRef: IssueRowRef,
): ContractIssue {
  return { kind, severity, path, expected, received, rowRef };
}

function checkField(
  row: Record<string, unknown>,
  expectation: FieldExpectation,
  index: number,
  ref: IssueRowRef,
): ContractIssue | null {
  const path = `rows[${String(index)}].${expectation.field}`;
  if (!(expectation.field in row)) {
    return issue(
      'missing_field',
      'error',
      path,
      expectation.description,
      'absent',
      ref,
    );
  }
  const value = row[expectation.field];
  if (value === null) {
    if (!expectation.nullable) {
      return issue(
        'unexpected_null',
        'error',
        path,
        expectation.description,
        'null',
        ref,
      );
    }
    return null;
  }
  if (expectation.kind === 'number') {
    return typeof value === 'number'
      ? null
      : issue(
          'type_mismatch',
          'error',
          path,
          expectation.description,
          clampReceived(value),
          ref,
        );
  }
  if (expectation.kind === 'count') {
    return typeof value === 'number' || value === FULL_MARKER
      ? null
      : issue(
          'type_mismatch',
          'error',
          path,
          expectation.description,
          clampReceived(value),
          ref,
        );
  }
  if (typeof value !== 'string') {
    return issue(
      'type_mismatch',
      'error',
      path,
      expectation.description,
      clampReceived(value),
      ref,
    );
  }
  if (expectation.pattern !== undefined && !expectation.pattern.test(value)) {
    return issue(
      'format_violation',
      'error',
      path,
      expectation.description,
      clampReceived(value),
      ref,
    );
  }
  if (expectation.enum !== undefined && !expectation.enum.includes(value)) {
    return issue(
      'value_out_of_range',
      'error',
      path,
      expectation.description,
      clampReceived(value),
      ref,
    );
  }
  return null;
}

function unknownFieldIssues(
  row: Record<string, unknown>,
  index: number,
  ref: IssueRowRef,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  for (const key of Object.keys(row)) {
    if (!SECTION_ROW_FIELDS.has(key)) {
      issues.push(
        issue(
          'unknown_field',
          'warn',
          `rows[${String(index)}].${key}`,
          'no field beyond the known contract',
          clampReceived(row[key]),
          ref,
        ),
      );
    }
  }
  return issues;
}

function buildAggregates(issues: ContractIssue[]): IssueAggregate[] {
  const byPathKind = new Map<string, IssueAggregate>();
  for (const contractIssue of issues) {
    const key = `${contractIssue.path}::${contractIssue.kind}`;
    const existing = byPathKind.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.samples.length < ISSUE_SAMPLE_CAP) {
        existing.samples.push(contractIssue.received);
      }
    } else {
      byPathKind.set(key, {
        path: contractIssue.path,
        kind: contractIssue.kind,
        count: 1,
        samples: [contractIssue.received],
      });
    }
  }
  return [...byPathKind.values()];
}

function buildReport(
  rows: Record<string, unknown>[],
  issues: ContractIssue[],
  deduped: number,
  context: AuditContext,
): DataQualityReport {
  const byKind = emptyByKind();
  for (const contractIssue of issues) {
    byKind[contractIssue.kind] += 1;
  }
  return {
    reportVersion: 1,
    extensionVersion: context.extensionVersion,
    generatedAt: context.generatedAt,
    request: context.request,
    totals: { rows: rows.length, deduped, issues: issues.length, byKind },
    aggregates: buildAggregates(issues),
    issues: issues.slice(0, ISSUE_CAP),
  };
}

function uniqueTeachTableIds(rows: Record<string, unknown>[]): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.teach_table_id === 'string') {
      ids.add(row.teach_table_id);
    }
  }
  return ids.size;
}

/** Audit a teach table response against the full contract. */
export function auditTeachTable(
  response: unknown,
  context: AuditContext,
): DataQualityReport {
  const rows = flattenTeachTableRows(response);
  const issues: ContractIssue[] = [];
  rows.forEach((row, index) => {
    const ref = toRowRef(row, index);
    for (const expectation of SECTION_ROW_EXPECTATIONS) {
      const fieldIssue = checkField(row, expectation, index, ref);
      if (fieldIssue !== null) {
        issues.push(fieldIssue);
      }
    }
    issues.push(...unknownFieldIssues(row, index, ref));
    for (const rule of CROSS_FIELD_RULES) {
      const received = rule.check(row, rows);
      if (received !== null) {
        issues.push(
          issue(
            'cross_field',
            'error',
            `rows[${String(index)}].${rule.field}`,
            rule.description,
            received,
            ref,
          ),
        );
      }
    }
  });
  return buildReport(rows, issues, uniqueTeachTableIds(rows), context);
}

/** Audit a flat reference response against a minimal expectation table. */
export function auditReference(
  response: unknown,
  expectations: readonly FieldExpectation[],
  context: AuditContext,
): DataQualityReport {
  const rows = collectRecords(response);
  const issues: ContractIssue[] = [];
  rows.forEach((row, index) => {
    const ref = toRowRef(row, index);
    for (const expectation of expectations) {
      const fieldIssue = checkField(row, expectation, index, ref);
      if (fieldIssue !== null) {
        issues.push(fieldIssue);
      }
    }
  });
  return buildReport(rows, issues, rows.length, context);
}
