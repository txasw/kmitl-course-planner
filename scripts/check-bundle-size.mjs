// Fails when a packed production zip exceeds its budget in bundle-budget.mjs. Run
// after `wxt zip`, with the targets to check as arguments:
//
//   node scripts/check-bundle-size.mjs chrome firefox
//
// It reads the zips for the current package version from .output, where WXT writes
// them, so zips left over from an earlier version are ignored.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkBundleSize,
  describeBundleSize,
  zipFileName,
} from './bundle-budget.mjs';

const OUTPUT_DIR = '.output';
const browsers = process.argv.slice(2);
if (browsers.length === 0) {
  console.error('bundle size check: name at least one target, such as chrome');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
let failed = false;

for (const browser of browsers) {
  const zipPath = join(OUTPUT_DIR, zipFileName(version, browser));
  if (!existsSync(zipPath)) {
    console.error(
      `bundle size check: ${zipPath} does not exist; run wxt zip -b ${browser} first`,
    );
    failed = true;
    continue;
  }
  const bytes = statSync(zipPath).size;
  const error = checkBundleSize(browser, bytes);
  if (error === null) {
    console.log(describeBundleSize(browser, bytes));
  } else {
    console.error(`bundle size check: ${error}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
