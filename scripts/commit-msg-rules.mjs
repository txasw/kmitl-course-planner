// Message rules shared by the commit-msg hook and the CI checks. A solo project
// keeps commit messages and pull request descriptions to plain prose: the only
// trailers allowed are the few that carry review or issue meaning, a trailer never
// carries a link, and neither text ends on a bare link line.

const ALLOWED_TRAILERS = new Set([
  'signed-off-by',
  'refs',
  'fixes',
  'breaking change',
  'breaking-change',
]);

// Trailers whose value must be issue or pull request numbers such as "#12, #14".
const ISSUE_TRAILERS = new Set(['refs', 'fixes']);
const ISSUE_LIST = /^#\d+(\s*,\s*#\d+)*$/;

// git's trailer token: a word of letters, digits and hyphens followed by a colon.
// BREAKING CHANGE is the one token with a space that Conventional Commits defines.
const TRAILER_LINE = /^(BREAKING CHANGE|[A-Za-z][A-Za-z0-9-]*):\s+(\S.*)$/;

// A capitalized hyphenated token such as Reviewed-by: is trailer shaped wherever it
// appears, so commit messages check it on every line, not only the final paragraph.
const HYPHENATED_TOKEN = /^([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+):\s/;

const CO_AUTHOR = /^\s*co-authored-by:/im;
const URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\//i;
const BARE_URL_LINE = /^<?[a-z][a-z0-9+.-]*:\/\/\S+>?$/i;

// Match emoji through the Extended_Pictographic property and flags through the
// regional indicator range. Thai (U+0E00 to U+0E7F) carries neither property, so
// it passes. A property escape avoids combining marks inside a character class.
const PICTOGRAPH = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u;

function toLf(text) {
  return text.replace(/\r\n?/g, '\n');
}

function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trimEnd()))
    .map((lines) => lines.filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0);
}

function trailerErrors(lines) {
  const errors = [];
  for (const line of lines) {
    const match = TRAILER_LINE.exec(line);
    if (!match) continue;
    const token = match[1].toLowerCase();
    const value = match[2];
    if (!ALLOWED_TRAILERS.has(token)) {
      errors.push(`Trailer "${match[1]}" is not allowed.`);
      continue;
    }
    if (URL_PATTERN.test(value)) {
      errors.push(`Trailer "${match[1]}" must not contain a link.`);
    } else if (ISSUE_TRAILERS.has(token) && !ISSUE_LIST.test(value)) {
      errors.push(`Trailer "${match[1]}" takes issue numbers such as #12.`);
    }
  }
  return errors;
}

// Follows git's trailer block rule: the final paragraph is a trailer block only when
// every line in it is Token: value. Wrapped prose whose last paragraph happens to
// open with a word and a colon is therefore left alone.
function finalTrailerBlock(blocks) {
  if (blocks.length < 2) return [];
  const last = blocks[blocks.length - 1] ?? [];
  return last.every((line) => TRAILER_LINE.test(line)) ? last : [];
}

function endsWithBareLink(blocks) {
  const lastBlock = blocks[blocks.length - 1] ?? [];
  const lastLine = lastBlock[lastBlock.length - 1]?.trim() ?? '';
  return blocks.length > 1 && BARE_URL_LINE.test(lastLine);
}

/**
 * Checks a commit message as git stores it. Comment lines are dropped first,
 * as git does when it records the message.
 * @param {string} raw
 * @returns {string[]} one entry per broken rule, empty when the message passes
 */
export function checkCommitMessage(raw) {
  const message = toLf(raw)
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n');
  const blocks = paragraphs(message);
  const errors = [];
  if (CO_AUTHOR.test(message)) {
    errors.push('Co-Authored-By trailers are not allowed.');
  }
  if (PICTOGRAPH.test(message)) {
    errors.push('Emoji and pictographs are not allowed.');
  }
  errors.push(...trailerErrors(finalTrailerBlock(blocks)));
  for (const line of message.split('\n')) {
    const token = HYPHENATED_TOKEN.exec(line.trim())?.[1];
    if (token && !ALLOWED_TRAILERS.has(token.toLowerCase())) {
      errors.push(`Trailer "${token}" is not allowed.`);
    }
  }
  if (endsWithBareLink(blocks)) {
    errors.push('The message must not end with a bare link line.');
  }
  return [...new Set(errors)];
}

/**
 * Checks a pull request description. A description is Markdown prose that may
 * quote third party release notes, so only the attribution shapes are checked: a
 * Co-Authored-By line, a link inside a trailer shaped final paragraph, and a bare
 * link as the last line.
 * @param {string} raw
 * @returns {string[]} one entry per broken rule, empty when the description passes
 */
export function checkPullRequestBody(raw) {
  const body = toLf(raw);
  const blocks = paragraphs(body);
  const errors = [];
  if (CO_AUTHOR.test(body)) {
    errors.push('Co-Authored-By lines are not allowed.');
  }
  if (finalTrailerBlock(blocks).some((line) => URL_PATTERN.test(line))) {
    errors.push('A trailer line must not contain a link.');
  }
  if (endsWithBareLink(blocks)) {
    errors.push('The description must not end with a bare link line.');
  }
  return errors;
}
