import { describe, expect, it } from 'vitest';
import {
  curriculumEndpoint,
  facultyEndpoint,
  subjectOwnerEndpoint,
  teachTableCacheKey,
  teachTableParams,
  teachTableUrl,
} from './endpoints';
import type { TeachTableQuery } from '../messaging/protocol';

const ownerQuery: TeachTableQuery = {
  mode: 'by_subject_owner_id',
  selected_year: '2569',
  selected_semester: '1',
  selected_faculty: '01',
  search_all_faculty: false,
  selected_subject_owner_id: '32',
};

describe('reference endpoints', () => {
  it('points reference calls at the api host with static cache keys', () => {
    expect(facultyEndpoint.url).toBe(
      'https://api.reg.kmitl.ac.th/faculty/?function=get-faculty',
    );
    expect(facultyEndpoint.cacheKey).toBe('kcp:cache:ref:faculty');
    expect(curriculumEndpoint.url).toContain('LEVEL_ID=1');
  });

  it('builds the subject owner url with literal brackets and encoded json', () => {
    const url = subjectOwnerEndpoint.url;
    expect(url).toContain('select[]=TEACH_TABLE_SUBJECT_OWNER_ID');
    // The where and order values are percent encoded json objects.
    expect(url).toContain('where[]=%7B');
    expect(url).toContain('order[]=%7B');
    // The bracket keys stay literal rather than being encoded to %5B%5D.
    expect(url).not.toContain('%5B%5D');
  });
});

describe('teach table request building', () => {
  it('serializes the search flags to string booleans', () => {
    const params = teachTableParams(ownerQuery);
    expect(params.mode).toBe('by_subject_owner_id');
    expect(params.search_all_faculty).toBe('false');
    expect(params.selected_subject_owner_id).toBe('32');
  });

  it('puts the function and every param on the teach table url', () => {
    const url = teachTableUrl(ownerQuery);
    expect(url).toContain('function=get-teach-table-show');
    expect(url).toContain('mode=by_subject_owner_id');
    expect(url).toContain('selected_subject_owner_id=32');
  });

  it('derives a stable cache key that separates distinct queries', () => {
    const other: TeachTableQuery = {
      ...ownerQuery,
      selected_subject_owner_id: '46',
    };
    expect(teachTableCacheKey(ownerQuery)).toBe(teachTableCacheKey(ownerQuery));
    expect(teachTableCacheKey(ownerQuery)).not.toBe(teachTableCacheKey(other));
    expect(teachTableCacheKey(ownerQuery)).toContain('kcp:cache:teach:');
  });
});
