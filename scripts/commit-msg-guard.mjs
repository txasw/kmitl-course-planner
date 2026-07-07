// Commit message guard. Rejects any Co-Authored-By trailer and any emoji or
// pictograph, while allowing Thai (U+0E00 to U+0E7F, which sits outside every
// emoji block). Implemented in Node so Unicode handling is identical on Git
// Bash for Windows and on the Linux CI runner.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('commit-msg guard: missing commit message path');
  process.exit(1);
}

const message = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('#'))
  .join('\n');

const errors = [];

if (/^\s*co-authored-by:/im.test(message)) {
  errors.push('Co-Authored-By trailers are not allowed.');
}

// Match emoji through the Extended_Pictographic property and flags through the
// regional indicator range. Thai and ordinary text carry neither property, so
// they pass. Using a property escape avoids combining marks inside a character
// class, which would be both misleading and lint flagged.
const pictograph = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u;
if (pictograph.test(message)) {
  errors.push('Emoji and pictographs are not allowed in commit messages.');
}

if (errors.length > 0) {
  console.error('commit-msg rejected:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
