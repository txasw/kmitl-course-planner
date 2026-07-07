import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures');

/**
 * Read a committed fixture file and return it as untrusted `unknown`, so tests
 * pass it through the same validation the production code uses. Vitest runs with
 * the project root as the working directory, so a bare fixture name resolves.
 */
export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf8'));
}
