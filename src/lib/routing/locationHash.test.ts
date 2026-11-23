import { describe, expect, it } from 'vitest';
import { parseTeachTableRoute } from './parseTeachTableRoute';
import { routePath, sanitizeHash } from './locationHash';

// Values the host may carry in its address that KCP must never hold: a token after a
// sign in, and a student id on an officer or report page, under both names in use.
const SECRETS = ['SECRET.jwt.value', '65010001', '64010999'];

function keepsNoSecret(hash: string): void {
  const sanitized = sanitizeHash(hash);
  for (const secret of SECRETS) {
    expect(sanitized).not.toContain(secret);
  }
  expect(sanitized).not.toMatch(/token|student_id|std_id|state|code=/);
}

describe('routePath', () => {
  it('reads the path of a hash with or without its marker', () => {
    expect(routePath('#/pre_registration')).toBe('/pre_registration');
    expect(routePath('/teach_table')).toBe('/teach_table');
  });

  it('stops at the query', () => {
    expect(routePath('#/teach_table?mode=by_class&selected_year=2569')).toBe(
      '/teach_table',
    );
  });

  it('stops at fields a sign in redirect appends', () => {
    expect(routePath('#/main_menu&state=abc&code=xyz')).toBe('/main_menu');
  });

  it('names no path for an empty hash or one that is not a route', () => {
    expect(routePath('')).toBe('');
    expect(routePath('#')).toBe('');
    expect(routePath('#access_token=abc&token_type=bearer')).toBe('');
  });
});

describe('sanitizeHash', () => {
  it('drops a sign in token from the address', () => {
    expect(sanitizeHash('#/google_oauth_handling?token=SECRET.jwt.value')).toBe(
      '#/google_oauth_handling',
    );
    keepsNoSecret('#/google_oauth_handling?token=SECRET.jwt.value');
    keepsNoSecret('#access_token=SECRET.jwt.value&token_type=bearer');
    keepsNoSecret(
      '#/pre_registration&state=SECRET.jwt.value&code=SECRET.jwt.value',
    );
  });

  it('drops a student id under either name', () => {
    expect(sanitizeHash('#/report_student?student_id=65010001')).toBe(
      '#/report_student',
    );
    expect(sanitizeHash('#/registration_for_officer?std_id=64010999')).toBe(
      '#/registration_for_officer',
    );
    keepsNoSecret('#/report_student?student_id=65010001&std_id=64010999');
  });

  it('keeps only the search fields of a result route', () => {
    const hash =
      '#/teach_table?mode=by_subject_owner_id&selected_year=2569&student_id=65010001&selected_semester=1&token=SECRET.jwt.value&std_id=64010999&selected_faculty=01&search_all_faculty=false&selected_subject_owner_id=46';
    keepsNoSecret(hash);
    expect(parseTeachTableRoute(sanitizeHash(hash))?.params).toEqual({
      mode: 'by_subject_owner_id',
      selected_year: '2569',
      selected_semester: '1',
      selected_faculty: '01',
      search_all_faculty: 'false',
      selected_subject_owner_id: '46',
    });
  });

  it('drops a token or a student id written in any letter case', () => {
    keepsNoSecret(
      '#/teach_table?selected_year=2569&TOKEN=SECRET.jwt.value&Student_ID=65010001&STD_ID=64010999',
    );
    keepsNoSecret(
      '#/report_student?STUDENT_ID=65010001&Token=SECRET.jwt.value',
    );
  });

  it('drops a token or a student id under an encoded name', () => {
    const hash =
      '#/teach_table?selected_year=2569&t%6Fken=SECRET.jwt.value&student%5Fid=65010001&std_%69d=64010999';
    keepsNoSecret(hash);
    expect(sanitizeHash(hash)).toBe('#/teach_table?selected_year=2569');
    keepsNoSecret('#/google_oauth_handling%3Ftoken%3DSECRET.jwt.value');
  });

  it('drops every copy of a repeated token or student id', () => {
    keepsNoSecret(
      '#/teach_table?token=SECRET.jwt.value&selected_year=2569&token=SECRET.jwt.value&student_id=65010001&std_id=64010999&student_id=65010001',
    );
  });

  it('drops a search field whose value carries a folded in query', () => {
    for (const hash of [
      '#/teach_table?mode=by_class&selected_year=2569?token=SECRET.jwt.value',
      '#/teach_table?mode=by_class&selected_year=2569%26student_id%3D65010001',
      '#/teach_table?mode=by_class&selected_year=2569#std_id=64010999',
    ]) {
      keepsNoSecret(hash);
      expect(sanitizeHash(hash)).toBe('#/teach_table?mode=by_class');
    }
  });

  it('keeps every field each search mode sends', () => {
    const hash =
      '#/teach_table?mode=by_class&selected_year=2569&selected_semester=2&selected_faculty=01&selected_department=05&selected_curriculum=137&selected_class_year=0&search_all_faculty=false&search_all_department=false&search_all_curriculum=false&search_all_class_year=true&selected_subject_id=01076001&selected_subject_owner_id=32';
    expect(sanitizeHash(hash)).toBe(hash);
  });

  it('keeps the route path of every other page as it is', () => {
    expect(sanitizeHash('#/teach_table_selector')).toBe(
      '#/teach_table_selector',
    );
    expect(sanitizeHash('#/teach_table')).toBe('#/teach_table');
    expect(sanitizeHash('#/pre_registration')).toBe('#/pre_registration');
  });

  it('reads an absent hash or one that names no route as empty', () => {
    expect(sanitizeHash('')).toBe('');
    expect(sanitizeHash('#')).toBe('');
    expect(sanitizeHash('#state=SECRET.jwt.value')).toBe('');
  });
});
