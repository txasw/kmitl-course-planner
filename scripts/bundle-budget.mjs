// The size budget for the packed extension, shared by the CI check and its unit
// tests. A zip over budget fails the build, so growth is a decision recorded with a
// budget change in the same pull request rather than something that drifts in.

const KIB = 1024;

/** The largest packed zip, in bytes, that each production target may ship. */
export const BUNDLE_BUDGETS = Object.freeze({
  chrome: 305 * KIB,
  firefox: 305 * KIB,
});

function formatKib(bytes) {
  return `${(bytes / KIB).toFixed(1)} KiB`;
}

/** One line reporting a zip size against its budget, for the job log. */
export function describeBundleSize(browser, bytes) {
  const budget = BUNDLE_BUDGETS[browser];
  return `${browser} zip is ${formatKib(bytes)} (${bytes} bytes) against a budget of ${formatKib(budget)} (${budget} bytes)`;
}

/**
 * The error for a zip over its budget, or null when it fits. An unknown target
 * is an error too, so a new browser cannot skip the check by having no budget.
 */
export function checkBundleSize(browser, bytes) {
  const budget = BUNDLE_BUDGETS[browser];
  if (budget === undefined) {
    return `no bundle budget is set for ${browser}; add one to scripts/bundle-budget.mjs`;
  }
  if (bytes > budget) {
    return `${describeBundleSize(browser, bytes)}, which is ${bytes - budget} bytes over. Reduce the bundle, or raise the budget in scripts/bundle-budget.mjs and give the reason in the pull request.`;
  }
  return null;
}
