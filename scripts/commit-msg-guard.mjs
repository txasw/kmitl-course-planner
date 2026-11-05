// Commit message guard for the commit-msg hook and the CI range check. The rules
// live in commit-msg-rules.mjs so the unit tests and the pull request check share
// them. Implemented in Node so Unicode handling is identical on Git Bash for
// Windows and on the Linux CI runner.
import { readFileSync } from 'node:fs';
import {
  checkCommitMessage,
  checkPullRequestBody,
} from './commit-msg-rules.mjs';

const args = process.argv.slice(2);
const isBody = args[0] === '--pr-body';
const file = isBody ? args[1] : args[0];
if (!file) {
  console.error('commit-msg guard: missing message path');
  process.exit(1);
}

const text = readFileSync(file, 'utf8');
const errors = isBody ? checkPullRequestBody(text) : checkCommitMessage(text);

if (errors.length > 0) {
  console.error(
    isBody ? 'pull request description rejected:' : 'commit-msg rejected:',
  );
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
