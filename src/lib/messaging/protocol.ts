// The core contract both sides of the worker boundary import. Request messages are
// a discriminated union validated at runtime by the worker router; responses are the
// typed Result values the gateway produces. The debug namespace lives in debugTypes
// and the host check in lib/regis/protocol, and the extension protocol composes them,
// so this module reaches no debug, contract, or registration code.

import { z } from 'zod';
import type { Result } from '../utils/result';
import type {
  RawFaculty,
  RawDepartment,
  RawCurriculum,
  RawSubjectOwner,
  RawCurrentTerm,
} from '../domain/schemas';
import type { TeachTableResult } from '../api/types';

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

// The options a request that can reach the network carries. refresh skips the cache, and
// noRetry makes a transient failure final after one attempt. A reference list may also
// be read from the cache alone, which answers a miss with a network error and fetches
// nothing. The registration pages use the last two (ADR-0075).
const networkOptions = {
  refresh: z.boolean().optional(),
  noRetry: z.boolean().optional(),
};
const referenceOptions = {
  ...networkOptions,
  cacheOnly: z.boolean().optional(),
};

export const coreRequestMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ref/faculty'), ...referenceOptions }),
  z.object({ type: z.literal('ref/department'), ...referenceOptions }),
  z.object({ type: z.literal('ref/curriculum'), ...referenceOptions }),
  z.object({ type: z.literal('ref/subjectOwner'), ...referenceOptions }),
  z.object({ type: z.literal('ref/currentTerm'), ...referenceOptions }),
  z.object({
    type: z.literal('teachTable/query'),
    query: teachTableQuerySchema,
    ...networkOptions,
  }),
  z.object({
    type: z.literal('teachTable/cancel'),
    query: teachTableQuerySchema,
  }),
  z.object({ type: z.literal('shell/mounted') }),
  z.object({ type: z.literal('onboarding/claimWelcome') }),
]);

export type CoreRequestMessage = z.infer<typeof coreRequestMessageSchema>;

/**
 * The worker's answer to the mount handshake: whether this tab was opened to show the
 * panel, and the open shortcut as the browser reports it, or null when none is
 * assigned.
 */
export const mountHandshakeSchema = z.object({
  openPanel: z.boolean(),
  shortcut: z.string().nullable(),
});
export type MountHandshake = z.infer<typeof mountHandshakeSchema>;

/**
 * The successful shell/mounted reply. The content side checks the reply against it on
 * receipt, so an error Result and a malformed reply alike settle with no open.
 */
export const mountedReplySchema = z.object({
  ok: z.literal(true),
  value: mountHandshakeSchema,
});

/** The worker's answer to a welcome claim: whether this tab may show the welcome. */
export const welcomeClaimSchema = z.object({ granted: z.boolean() });
export type WelcomeClaim = z.infer<typeof welcomeClaimSchema>;

/**
 * The successful onboarding/claimWelcome reply, checked on receipt like the mount
 * reply, so an error Result and a malformed reply alike count as a denial.
 */
export const claimWelcomeReplySchema = z.object({
  ok: z.literal(true),
  value: welcomeClaimSchema,
});

/** The response payload each core request type resolves to, keyed by discriminant. */
export interface CoreResponseMap {
  'ref/faculty': Result<RawFaculty[]>;
  'ref/department': Result<RawDepartment[]>;
  'ref/curriculum': Result<RawCurriculum[]>;
  'ref/subjectOwner': Result<RawSubjectOwner[]>;
  'ref/currentTerm': Result<RawCurrentTerm>;
  'teachTable/query': Result<TeachTableResult>;
  'teachTable/cancel': Result<void>;
  'shell/mounted': Result<MountHandshake>;
  'onboarding/claimWelcome': Result<WelcomeClaim>;
}

// The sealed error taxonomy from utils/result as a schema, so the error arm of a
// reply is checked down to the kind the UI branches on.
const apiErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('network'), message: z.string() }),
  z.object({ kind: z.literal('timeout'), message: z.string() }),
  z.object({
    kind: z.literal('http'),
    status: z.number(),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
  z.object({
    kind: z.literal('validation'),
    issues: z.array(z.object({ path: z.string(), message: z.string() })),
    message: z.string(),
  }),
  z.object({ kind: z.literal('storage'), message: z.string() }),
  z.object({ kind: z.literal('unknown'), message: z.string() }),
]);

/**
 * The Result envelope every worker reply arrives in. Only the envelope is checked:
 * the success value is the worker's own gateway output, validated at the network
 * boundary, and the replies the content side reads field by field carry their own
 * schema above.
 */
export const resultEnvelopeSchema = z.union([
  // Optional because a void success loses its undefined value key when the
  // message is serialized to JSON on the way across.
  z.object({ ok: z.literal(true), value: z.unknown().optional() }),
  z.object({ ok: z.literal(false), error: apiErrorSchema }),
]);
