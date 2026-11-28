import { describe, expect, it } from 'vitest';
import {
  REGISTRATION_ROUTES,
  companionRoute,
  isRegistrationRoute,
  prepareRefused,
} from './registrationRoute';

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

describe('companionRoute', () => {
  it('names the two student registration pages', () => {
    expect(companionRoute('#/pre_registration')).toBe('preRegistration');
    expect(companionRoute('#/Pre_Registration/?step=2')).toBe(
      'preRegistration',
    );
    expect(companionRoute('#/registration')).toBe('registration');
  });

  it('leaves the officer, graduate, queue, and search pages to the panel', () => {
    expect(companionRoute('#/registration_for_officer')).toBeNull();
    expect(companionRoute('#/registration_x')).toBeNull();
    expect(companionRoute('#/registration_queue')).toBeNull();
    expect(companionRoute('#/teach_table_selector')).toBeNull();
    expect(companionRoute('')).toBeNull();
  });
});

describe('prepareRefused', () => {
  it('allows prepare anywhere outside the registration pages', () => {
    expect(prepareRefused('#/teach_table_selector', 'planner')).toBe(false);
    expect(prepareRefused('#/teach_table_selector', 'helper')).toBe(false);
  });

  it('allows it on pre registration only from the helper', () => {
    expect(prepareRefused('#/pre_registration', 'helper')).toBe(false);
    expect(prepareRefused('#/Pre_Registration/', 'helper')).toBe(false);
    expect(prepareRefused('#/pre_registration', 'planner')).toBe(true);
  });

  it('refuses it on registration and every other registration page', () => {
    for (const path of REGISTRATION_ROUTES) {
      if (path === '/pre_registration') continue;
      expect(prepareRefused(`#${path}`, 'helper')).toBe(true);
      expect(prepareRefused(`#${path}`, 'planner')).toBe(true);
    }
  });
});
