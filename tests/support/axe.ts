import axe from 'axe-core';
import { expect } from 'vitest';

// Runs axe against a mounted subtree and asserts no critical or serious
// violations. Layout dependent rules are disabled because jsdom has no layout:
// color contrast cannot be computed, and page and landmark rules do not apply to
// a mounted fragment. This makes structural accessibility (roles, names, aria) a
// repeatable, CI enforced gate; contrast is verified in manual QA and the later
// contrast audit.
export async function expectNoSeriousA11yViolations(
  container: HTMLElement,
): Promise<void> {
  const results = await axe.run(container, {
    resultTypes: ['violations'],
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
      'document-title': { enabled: false },
      'html-has-lang': { enabled: false },
    },
  });

  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );
  const summary = blocking
    .map(
      (violation) =>
        `${violation.id} (${String(violation.impact)}): ${violation.help}`,
    )
    .join('\n');

  expect(blocking, summary).toEqual([]);
}
