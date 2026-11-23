import { describe, expect, it } from 'vitest';
import { REGISTRATION_ROUTES, isRegistrationRoute } from './route';

describe('isRegistrationRoute', () => {
  it.each(REGISTRATION_ROUTES)('treats %s as a registration page', (path) => {
    expect(isRegistrationRoute(`#${path}`)).toBe(true);
  });

  it('ignores a query, a trailing slash, and letter case', () => {
    expect(isRegistrationRoute('#/pre_registration?step=2')).toBe(true);
    expect(isRegistrationRoute('#/registration/')).toBe(true);
    expect(isRegistrationRoute('#/Pre_Registration')).toBe(true);
  });

  it('leaves the search, result, and other host pages alone', () => {
    expect(isRegistrationRoute('#/teach_table_selector')).toBe(false);
    expect(
      isRegistrationRoute('#/teach_table?mode=by_class&selected_year=2569'),
    ).toBe(false);
    expect(isRegistrationRoute('#/main_menu')).toBe(false);
    expect(isRegistrationRoute('#/registration_batch_jobs')).toBe(false);
    expect(isRegistrationRoute('#/student_timetable')).toBe(false);
    expect(isRegistrationRoute('#/')).toBe(false);
    expect(isRegistrationRoute('')).toBe(false);
  });

  it('does not match a page whose name only starts like one', () => {
    expect(isRegistrationRoute('#/registrations')).toBe(false);
    expect(isRegistrationRoute('#/pre_registration_result')).toBe(false);
  });
});
