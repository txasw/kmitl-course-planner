// Fails when a packed production zip exceeds its budget in bundle-budget.mjs. Run
// after `wxt zip`, with the targets to check as arguments:
//
//   node scripts/check-bundle-size.mjs chrome firefox
//
// It reads the zips from .output, where WXT writes them, and ignores the sources zip.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkBundleSize, describeBundleSize } from './bundle-budget.mjs';

const OUTPUT_DIR = '.output';
const browsers = process.argv.slice(2);
if (browsers.length === 0) {
  console.error('bundle size check: name at least one target, such as chrome');
  process.exit(1);
}

const zips = readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.zip'));
let failed = false;

for (const browser of browsers) {
  const matches = zips.filter((name) => name.endsWith(`-${browser}.zip`));
  if (matches.length !== 1) {
    console.error(
      `bundle size check: expected one ${browser} zip in ${OUTPUT_DIR}, found ${matches.length}; run wxt zip -b ${browser} first`,
    );
    failed = true;
    continue;
  }
  const bytes = statSync(join(OUTPUT_DIR, matches[0])).size;
  const error = checkBundleSize(browser, bytes);
  if (error === null) {
    console.log(describeBundleSize(browser, bytes));
  } else {
    console.error(`bundle size check: ${error}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
