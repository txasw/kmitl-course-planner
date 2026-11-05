import { describe, expect, it } from 'vitest';
import {
  checkCommitMessage,
  checkPullRequestBody,
} from '../../scripts/commit-msg-rules.mjs';

// Bodies copied from commits already on main. Each wraps its last paragraph so a
// line opens with a word and a colon, which must not read as a trailer block.
const WRAPPED_PROSE = [
  `feat(planner): drop the clock glyph from the block time

The ADR also states both reasons the time drops before the section
chip: dropping a flow line relieves a vertical overflow, and the section
code stays the disambiguator while approximate time is recoverable from the
axis.`,
  `test(planner): cover exam overlap after revalidation

A unit test proves the reconcile output feeds the warning
derivation: two entries with disjoint midterms warn on neither until a
revalidation moves one midterm onto the other, then both warn.`,
  `test(e2e): prove the plan flows in a real browser

The pointer drag is not exercised in the browser because dnd-kit's pointer sensor does
not drive reliably under headless Playwright; its validation, ghosts, chip, and
blocked strip are covered by component tests and the manual QA script.`,
];

// The grouped update body the dependency bot writes, trimmed to its shape: a YAML
// block of lowercase keys and a Signed-off-by trailer.
const BOT_UPDATE = `build(deps): bump the npm-minor-patch group with 6 updates

Bumps the npm-minor-patch group with 6 updates.

---
updated-dependencies:
- dependency-name: prettier
  dependency-version: 3.9.5
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: npm-minor-patch
...

Signed-off-by: dependabot[bot] <support@github.com>`;

describe('checkCommitMessage', () => {
  it.each(WRAPPED_PROSE)(
    'accepts wrapped prose ending in a word and a colon',
    (message) => {
      expect(checkCommitMessage(message)).toEqual([]);
    },
  );

  it('accepts the dependency bot body and the release commit', () => {
    expect(checkCommitMessage(BOT_UPDATE)).toEqual([]);
    expect(checkCommitMessage('chore: release version packages\n')).toEqual([]);
  });

  it('accepts Thai text and allowed trailers', () => {
    const message = `fix(i18n): แก้ข้อความปุ่มค้นหา

ข้อความเดิมยาวเกินไป

Refs: #123
Signed-off-by: Example Person <person@example.com>`;
    expect(checkCommitMessage(message)).toEqual([]);
  });

  it('drops comment lines as git does', () => {
    expect(
      checkCommitMessage('fix: a thing\n\n# Reviewed-by: nobody\n'),
    ).toEqual([]);
  });

  it('rejects an unlisted trailer in the final paragraph', () => {
    const errors = checkCommitMessage(
      'fix: a thing\n\nBody text.\n\nTracking-Id: 42\n',
    );
    expect(errors).toEqual(['Trailer "Tracking-Id" is not allowed.']);
  });

  it('rejects a single word trailer block that is not listed', () => {
    expect(
      checkCommitMessage('fix: a thing\n\nBody text.\n\nSource: notes\n'),
    ).toEqual(['Trailer "Source" is not allowed.']);
  });

  it('rejects Co-Authored-By in any case', () => {
    expect(
      checkCommitMessage('fix: a\n\nco-authored-by: Someone <a@b.c>\n'),
    ).toContain('Co-Authored-By trailers are not allowed.');
  });

  it('rejects a link inside an allowed trailer', () => {
    expect(
      checkCommitMessage(
        'fix: a\n\nBody.\n\nRefs: https://example.com/issues/1\n',
      ),
    ).toEqual(['Trailer "Refs" must not contain a link.']);
  });

  it('rejects Refs and Fixes values that are not issue numbers', () => {
    expect(
      checkCommitMessage('fix: a\n\nBody.\n\nFixes: the login bug\n'),
    ).toEqual(['Trailer "Fixes" takes issue numbers such as #12.']);
  });

  it('rejects a capitalized hyphenated token mid body', () => {
    const message =
      'fix: a\n\nReviewed-by: Someone\nmore prose follows here.\n';
    expect(checkCommitMessage(message)).toEqual([
      'Trailer "Reviewed-by" is not allowed.',
    ]);
  });

  it('rejects a message that ends with a bare link', () => {
    expect(
      checkCommitMessage('fix: a\n\nBody.\n\nhttps://example.com/x/1\n'),
    ).toEqual(['The message must not end with a bare link line.']);
  });

  it('rejects emoji but not Thai', () => {
    expect(checkCommitMessage('fix: ready \u{1F680}\n')).toEqual([
      'Emoji and pictographs are not allowed.',
    ]);
    expect(checkCommitMessage('fix: พร้อมใช้งาน\n')).toEqual([]);
  });
});

describe('checkPullRequestBody', () => {
  const TEMPLATE_BODY = `## Summary

Clears the advisories.

## Commit history

- [x] No attribution trailers and no emoji.`;

  it('accepts a template body and prose that ends with a word and a colon', () => {
    expect(checkPullRequestBody(TEMPLATE_BODY)).toEqual([]);
    expect(
      checkPullRequestBody(
        `${TEMPLATE_BODY}\n\nGated: hold merge until approval.`,
      ),
    ).toEqual([]);
  });

  it('accepts quoted release notes with links and emoji', () => {
    const body = `Bumps zod.\n\n<details>\n<summary>Release notes</summary>\n<p>Fixed \u{1F41B} in <a href="https://example.com/r">notes</a></p>\n</details>`;
    expect(checkPullRequestBody(body)).toEqual([]);
  });

  it('rejects a description that ends with a bare link', () => {
    expect(
      checkPullRequestBody(`${TEMPLATE_BODY}\n\nhttps://example.com/x/1`),
    ).toEqual(['The description must not end with a bare link line.']);
  });

  it('rejects a link in a trailer shaped final paragraph', () => {
    expect(
      checkPullRequestBody(`${TEMPLATE_BODY}\n\nSource: https://example.com/x`),
    ).toEqual(['A trailer line must not contain a link.']);
  });

  it('rejects a Co-Authored-By line', () => {
    expect(
      checkPullRequestBody(`${TEMPLATE_BODY}\n\nCo-Authored-By: A <a@b.c>`),
    ).toContain('Co-Authored-By lines are not allowed.');
  });
});
