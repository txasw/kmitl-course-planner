// The single contract both sides of the worker boundary import. Request messages
// are a discriminated union validated at runtime by the worker router; responses
// are the typed Result values the gateway produces. Debug only types are pulled
// with import type so they erase under verbatimModuleSyntax and never drag the
// debug canary into the production bundle.

import { z } from 'zod';
import type { Result } from '../utils/result';
import type {
  RawFaculty,
  RawDepartment,
  RawCurriculum,
  RawSubjectOwner,
} from '../domain/schemas';
import type { NormalizedCatalog } from '../domain/normalize';
import type { LatestRaw, RequestLogEntry, SimSettings } from '../api/types';
import type { DataQualityReport } from '../contract/report';

// The three search modes mirror Section 4.1. Booleans stay booleans here; the
// endpoint layer serializes the search_all_* flags to the string form the API
// expects. The gateway sends exactly the fields it is handed, so a mode may omit
// selects the live API does not require for that mode.
const byClassShape = {
  selected_year: z.string(),
  selected_semester: z.string(),
  selected_faculty: z.string(),
  selected_department: z.string(),
  selected_curriculum: z.string(),
  selected_class_year: z.string(),
  search_all_faculty: z.boolean(),
  search_all_department: z.boolean(),
  search_all_curriculum: z.boolean(),
  search_all_class_year: z.boolean(),
};

export const teachTableQuerySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('by_class'), ...byClassShape }),
  // The host searches a subject id across everything: it sends only the term and
  // the subject id with every search_all_* flag true, and no specific selects.
  // Verified against captured host traffic; see Section 6.2.
  z.object({
    mode: z.literal('by_subject_id'),
    selected_year: z.string(),
    selected_semester: z.string(),
    search_all_faculty: z.boolean(),
    search_all_department: z.boolean(),
    search_all_curriculum: z.boolean(),
    search_all_class_year: z.boolean(),
    selected_subject_id: z.string(),
  }),
  z.object({
    mode: z.literal('by_subject_owner_id'),
    selected_year: z.string(),
    selected_semester: z.string(),
    // Omitted for an all faculties search; present for a specific faculty.
    selected_faculty: z.string().optional(),
    search_all_faculty: z.boolean(),
    selected_subject_owner_id: z.string(),
  }),
]);

export type TeachTableQuery = z.infer<typeof teachTableQuerySchema>;

export const requestMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ref/faculty'), refresh: z.boolean().optional() }),
  z.object({
    type: z.literal('ref/department'),
    refresh: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('ref/curriculum'),
    refresh: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('ref/subjectOwner'),
    refresh: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('teachTable/query'),
    query: teachTableQuerySchema,
    refresh: z.boolean().optional(),
  }),
  z.object({ type: z.literal('debug/getRequestLog') }),
  z.object({ type: z.literal('debug/getReport') }),
  z.object({ type: z.literal('debug/getLatestRaw') }),
  z.object({ type: z.literal('debug/getSimulation') }),
  z.object({ type: z.literal('debug/clearCache') }),
  z.object({
    type: z.literal('debug/setFixture'),
    fixtureId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('debug/setFault'),
    faultId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('debug/setMutation'),
    mutationId: z.string().nullable(),
  }),
]);

export type RequestMessage = z.infer<typeof requestMessageSchema>;
export type RequestType = RequestMessage['type'];

/** The response payload each request type resolves to, keyed by discriminant. */
export interface ResponseMap {
  'ref/faculty': Result<RawFaculty[]>;
  'ref/department': Result<RawDepartment[]>;
  'ref/curriculum': Result<RawCurriculum[]>;
  'ref/subjectOwner': Result<RawSubjectOwner[]>;
  'teachTable/query': Result<NormalizedCatalog>;
  'debug/getRequestLog': Result<RequestLogEntry[]>;
  'debug/getReport': Result<DataQualityReport | null>;
  'debug/getLatestRaw': Result<LatestRaw | null>;
  'debug/getSimulation': Result<SimSettings>;
  'debug/clearCache': Result<void>;
  'debug/setFixture': Result<void>;
  'debug/setFault': Result<void>;
  'debug/setMutation': Result<void>;
}
