// Which host routes are the registration pages, where KCP keeps quiet (ADR-0075). The
// registration system carries its heaviest load while these pages are open, so on them
// KCP sends no request of its own: nothing runs on open, on a plan switch, or as a
// default, and what the student asks for runs once, without a retry. The classifier
// is pure and reads only the route path, never the query, so it never needs anything
// the address may carry besides the page name.

import { routePath } from './locationHash';

/** The registration pages of the host, by route path without the leading hash. */
export const REGISTRATION_ROUTES: readonly string[] = [
  '/pre_registration',
  '/registration',
  '/registration_for_officer',
  '/registration_x',
  '/registration_queue',
  '/registration_future_innovation',
];

/**
 * Whether a location hash names a registration page. The host router matches paths
 * without regard to case or a trailing slash, so neither changes the answer.
 */
export function isRegistrationRoute(hash: string): boolean {
  return REGISTRATION_ROUTES.includes(normalizedPath(hash));
}

function normalizedPath(hash: string): string {
  return routePath(hash).toLowerCase().replace(/\/+$/, '');
}

/**
 * The registration pages a student fills in, where the launcher opens the registration
 * helper dock beside the page instead of the full panel (ADR-0076). Only the student
 * pre registration and regular registration pages qualify, matched by the exact path,
 * so the officer, graduate, queue, and other pages that share a prefix keep the panel.
 */
export type CompanionRoute = 'preRegistration' | 'registration';

const COMPANION_ROUTES: Readonly<Record<string, CompanionRoute>> = {
  '/pre_registration': 'preRegistration',
  '/registration': 'registration',
};

/** The companion page a location hash names, or null for every other page. */
export function companionRoute(hash: string): CompanionRoute | null {
  return COMPANION_ROUTES[normalizedPath(hash)] ?? null;
}

/**
 * Where a press of prepare comes from: the prepare card in the planner, or the helper's
 * own row on the page where the student found nothing prepared.
 */
export type PrepareSource = 'planner' | 'helper';

/**
 * Whether the prepare action is refused on a page (ADR-0076). It runs at a calm time, so
 * every registration page refuses it, except pre registration when the student presses
 * prepare in the helper there: that page is where a student who never prepared is stuck,
 * its reads go through the background gateway to the public API one subject at a time
 * with no retry, and it is not the first come page. Registration itself always refuses.
 */
export function prepareRefused(hash: string, source: PrepareSource): boolean {
  if (!isRegistrationRoute(hash)) return false;
  return !(source === 'helper' && companionRoute(hash) === 'preRegistration');
}
