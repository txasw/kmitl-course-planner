// Runs axe-core against the extension's shadow root so it sees the mounted UI, limited
// to the WCAG 2 A and AA rules. Contrast is checked separately in the token contrast unit
// test, because axe cannot resolve the shadow root token backgrounds. Each violation
// carries the selectors of the nodes that failed it, so a failing scan names where.

import type { Page } from '@playwright/test';

const AXE_PATH = 'node_modules/axe-core/axe.min.js';

export interface AxeViolation {
  id: string;
  impact: string;
  targets: string[];
}

export async function axeViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const runner = (
      window as unknown as {
        axe: {
          run: (
            context: unknown,
            options: unknown,
          ) => Promise<{
            violations: {
              id: string;
              impact: string;
              nodes: { target: unknown[] }[];
            }[];
          }>;
        };
      }
    ).axe;
    const host = Array.from(document.body.children).find(
      (el) => el.shadowRoot !== null,
    );
    const root = host?.shadowRoot ?? document;
    const result = await runner.run(root, { runOnly: ['wcag2a', 'wcag2aa'] });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((node) => node.target.map(String).join(' ')),
    }));
  });
}
