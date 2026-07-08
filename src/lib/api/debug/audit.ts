// The audit interceptor runs the contract auditor on the raw response of each
// request and hands the report to the debug state. It selects the teach table
// auditor or the matching reference expectation table by endpoint. Debug only
// module; dropped from production and its canary never ships.

import {
  auditReference,
  auditTeachTable,
  type AuditContext,
} from '../../contract/auditor';
import {
  CURRICULUM_EXPECTATIONS,
  DEPARTMENT_EXPECTATIONS,
  FACULTY_EXPECTATIONS,
  SUBJECT_OWNER_EXPECTATIONS,
} from '../../contract/expectations';
import type { DataQualityReport } from '../../contract/report';
import type { AuditInterceptor } from '../interceptors';
import type { RequestContext } from '../types';

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface AuditDeps {
  extensionVersion: string;
  now: () => string;
  onReport: (report: DataQualityReport) => void;
  /** Receives the raw payload so the drawer can show it beside the normalized. */
  onRaw?: (context: RequestContext, raw: unknown) => void;
}

function runAudit(
  endpoint: string,
  raw: unknown,
  context: AuditContext,
): DataQualityReport {
  switch (endpoint) {
    case 'get-teach-table-show':
      return auditTeachTable(raw, context);
    case 'get-faculty':
      return auditReference(raw, FACULTY_EXPECTATIONS, context);
    case 'get-registrar-department':
      return auditReference(raw, DEPARTMENT_EXPECTATIONS, context);
    case 'get-curriculum':
      return auditReference(raw, CURRICULUM_EXPECTATIONS, context);
    case 'get-reference':
      return auditReference(raw, SUBJECT_OWNER_EXPECTATIONS, context);
    default:
      return auditReference(raw, [], context);
  }
}

export function createAuditInterceptor(deps: AuditDeps): AuditInterceptor {
  return {
    observe(context, raw) {
      const report = runAudit(context.endpoint, raw, {
        extensionVersion: deps.extensionVersion,
        generatedAt: deps.now(),
        request: { endpoint: context.endpoint, params: context.params },
      });
      deps.onReport(report);
      deps.onRaw?.(context, raw);
    },
  };
}
