// The KMITL origins the extension is allowed to reach, in one place so the
// manifest, the content script matches, and the worker agree by construction.
// This module imports nothing because the manifest builder loads it at build
// time, outside the bundler and its path aliases.

/** The registration site, which hosts the content script and the teach table API. */
export const REGIS_ORIGIN = 'https://regis.reg.kmitl.ac.th';

/** The reference data API for faculties, departments, curricula, and owners. */
export const API_ORIGIN = 'https://api.reg.kmitl.ac.th';

/** Both origins as bare origins, without a path. */
export const HOST_ORIGINS = [REGIS_ORIGIN, API_ORIGIN] as const;

/**
 * Both origins as match patterns. These are the manifest host permissions, and
 * the form the permissions API expects in its origins list.
 */
export const HOST_MATCH_PATTERNS: readonly string[] = HOST_ORIGINS.map(
  (origin) => `${origin}/*`,
);

/** The only pages the content script runs on. */
export const REGIS_MATCH_PATTERN = `${REGIS_ORIGIN}/*`;

/** The host search page, where a student starts a course search. */
export const SELECTOR_URL = `${REGIS_ORIGIN}/#/teach_table_selector`;
