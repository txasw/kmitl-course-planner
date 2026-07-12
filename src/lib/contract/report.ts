// The data quality report types produced by the contract auditor. These mirror
// Section 6.8 exactly. The report is a diagnostics artifact: it never leaves the
// machine, and this module ships only in debug builds and tests. It embeds a
// canary the production bundle check greps for.

export const DEBUG_CANARY = 'kcp-debug-canary';

export type IssueKind =
  | 'missing_field'
  | 'unexpected_null'
  | 'type_mismatch'
  | 'format_violation'
  | 'value_out_of_range'
  | 'cross_field'
  | 'unknown_field';

export type IssueSeverity = 'error' | 'warn' | 'info';

export interface IssueRowRef {
  teachTableId?: string;
  subjectId?: string;
  index: number;
}

export interface ContractIssue {
  kind: IssueKind;
  severity: IssueSeverity;
  /** Dotted path with a row index, for example rows[12].teach_time2. */
  path: string;
  expected: string;
  received: string;
  rowRef: IssueRowRef;
}

export interface IssueAggregate {
  path: string;
  kind: IssueKind;
  count: number;
  samples: string[];
}

export interface ReportTotals {
  rows: number;
  deduped: number;
  issues: number;
  /** Rows that are a valid unscheduled sentinel (teach_day 0 with zeroed times), not
   * an error. Surfaced so a mass day zero regression, where the API sends day 0 for
   * rows that should carry a real day, is visible as an unexpected spike rather than
   * hiding as silently accepted rows. */
  unscheduled: number;
  /** Rows carrying at least one parseable teachtime_str extra meeting segment. These
   * were silently dropped before the field was parsed, so the count makes the multi
   * meeting sections visible. */
  extraMeetings: number;
  byKind: Record<IssueKind, number>;
}

export interface DataQualityReport {
  reportVersion: 1;
  extensionVersion: string;
  generatedAt: string;
  request: { endpoint: string; params: Record<string, string> };
  totals: ReportTotals;
  aggregates: IssueAggregate[];
  /** Capped at ISSUE_CAP; totals.issues carries the untruncated count. */
  issues: ContractIssue[];
}

/** Maximum issues retained in the report body; the total count is never capped. */
export const ISSUE_CAP = 500;

/** Maximum received samples kept per aggregated path and kind. */
export const ISSUE_SAMPLE_CAP = 5;

export function emptyByKind(): Record<IssueKind, number> {
  return {
    missing_field: 0,
    unexpected_null: 0,
    type_mismatch: 0,
    format_violation: 0,
    value_out_of_range: 0,
    cross_field: 0,
    unknown_field: 0,
  };
}
