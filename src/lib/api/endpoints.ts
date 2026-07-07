// URL builders and descriptors for the five endpoints. Each descriptor pairs an
// endpoint with the schema that validates its response, its cache ttl, and its
// cache key. Reference endpoints are parameter free and cache under a static key.
// The teach table endpoint takes a query, whose flags serialize to string
// booleans, and caches under a hash of its full parameter set. The subject owner
// reference is built by hand because its select/where/order keys carry literal
// brackets and percent encoded JSON, which URLSearchParams would double encode.

import type { z } from 'zod';
import {
  curriculumListSchema,
  departmentListSchema,
  facultyListSchema,
  subjectOwnerListSchema,
  teachTableResponseSchema,
  type RawCurriculum,
  type RawDepartment,
  type RawFaculty,
  type RawSubjectOwner,
} from '../domain/schemas';
import type { TeachTableQuery } from '../messaging/protocol';
import {
  REFERENCE_TTL_MS,
  TEACH_TABLE_TTL_MS,
  refCacheKey,
  teachCacheKey,
} from '../storage/keys';
import { hashKey, stableParamString } from './cache';

export interface ReferenceEndpoint<T> {
  /** Function name used for the request log and the audit context. */
  endpoint: string;
  url: string;
  schema: z.ZodType<T>;
  ttlMs: number;
  cacheKey: string;
}

const API_BASE = 'https://api.reg.kmitl.ac.th';
const TEACH_TABLE_URL =
  'https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show';
export const TEACH_TABLE_ENDPOINT = 'get-teach-table-show';

function subjectOwnerUrl(): string {
  const where = encodeURIComponent(
    JSON.stringify({
      TEACH_TABLE_SUBJECT_TYPE_ID: '1',
      TEACH_TABLE_SUBJECT_OWNER_MAIN_PAGE: '1',
    }),
  );
  const order = encodeURIComponent(
    JSON.stringify({ TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_TH: 'ASC' }),
  );
  return (
    `${API_BASE}/reference/?function=get-reference` +
    '&table=TEACH_TABLE_SUBJECT_OWNER' +
    '&select[]=TEACH_TABLE_SUBJECT_OWNER_ID' +
    '&select[]=TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_TH' +
    '&select[]=TEACH_TABLE_SUBJECT_OWNER_NAME_MAIN_PAGE_EN' +
    `&where[]=${where}` +
    `&order[]=${order}`
  );
}

export const facultyEndpoint: ReferenceEndpoint<RawFaculty[]> = {
  endpoint: 'get-faculty',
  url: `${API_BASE}/faculty/?function=get-faculty`,
  schema: facultyListSchema,
  ttlMs: REFERENCE_TTL_MS,
  cacheKey: refCacheKey('faculty'),
};

export const departmentEndpoint: ReferenceEndpoint<RawDepartment[]> = {
  endpoint: 'get-registrar-department',
  url: `${API_BASE}/department/?function=get-registrar-department`,
  schema: departmentListSchema,
  ttlMs: REFERENCE_TTL_MS,
  cacheKey: refCacheKey('department'),
};

export const curriculumEndpoint: ReferenceEndpoint<RawCurriculum[]> = {
  endpoint: 'get-curriculum',
  url: `${API_BASE}/curriculum/?function=get-curriculum&LEVEL_ID=1`,
  schema: curriculumListSchema,
  ttlMs: REFERENCE_TTL_MS,
  cacheKey: refCacheKey('curriculum'),
};

export const subjectOwnerEndpoint: ReferenceEndpoint<RawSubjectOwner[]> = {
  endpoint: 'get-reference',
  url: subjectOwnerUrl(),
  schema: subjectOwnerListSchema,
  ttlMs: REFERENCE_TTL_MS,
  cacheKey: refCacheKey('subjectOwner'),
};

/** The teach table query params, with the search_all_* flags as string booleans. */
export function teachTableParams(
  query: TeachTableQuery,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    params[key] = typeof value === 'boolean' ? String(value) : value;
  }
  return params;
}

export function teachTableUrl(query: TeachTableQuery): string {
  const url = new URL(TEACH_TABLE_URL);
  for (const [key, value] of Object.entries(teachTableParams(query))) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function teachTableCacheKey(query: TeachTableQuery): string {
  const canonical = `${TEACH_TABLE_ENDPOINT}&${stableParamString(teachTableParams(query))}`;
  return teachCacheKey(hashKey(canonical));
}

export const teachTableEndpoint = {
  endpoint: TEACH_TABLE_ENDPOINT,
  schema: teachTableResponseSchema,
  ttlMs: TEACH_TABLE_TTL_MS,
} as const;
