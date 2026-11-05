import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';
import th from './th.json';
import en from './en.json';

// Guards the Section 2 tone rules on every rendered string: no emojis, no decorative
// punctuation such as em or en dashes, arrows, or symbol bullets, no exclamation marks,
// and no LLM filler words. Both dictionaries are checked for the punctuation and emoji
// rules; the banned word list is English, so it runs against the English copy. The emoji
// test covers pictographs, flag pairs, and the emoji presentation selector so a sequence
// emoji is caught, not only a lone pictograph. Tracked docs and source comments get the
// same emoji, punctuation, and banned word checks.

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{FE0F}/u;
const DECORATIVE = /[—–―‒−→←↔⇒⇐•●▪◦‣]/;
const BANNED = [
  'seamless',
  'delve',
  'robust',
  'leverage',
  'empower',
  'elevate',
  'supercharge',
  'cutting edge',
  'effortless',
  'revolutioni',
  'game changer',
  "let's",
];

// The host registration site's own vocabulary is canonical (docs/TERMINOLOGY.md). These
// are the near synonyms the host does not use; the section term is กลุ่มเรียน, not ตอน.
// ปฏิบัติการ is listed in full so the canonical ปฏิบัติ, the practice section kind, is not
// caught.
const BANNED_THAI = ['ตอน', 'ตอนเรียน', 'ภาคเรียน', 'ปฏิบัติการ'] as const;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}
const SRC_DIR = resolve(process.cwd(), 'src');
const I18N_DIR = join('lib', 'i18n');

// Section 2 also governs documentation and code comments. Only git tracked Markdown is
// scanned, so the private working material the repository ignores is never read.
// tests/fixtures holds captured host material, including the vendored Vuetify elevation
// classes in tests/fixtures/host-dom, which is upstream text rather than project prose.
const FIXTURES_PREFIX = 'tests/fixtures/';

// Accepted ADRs are immutable records: a later decision supersedes one through a new ADR
// rather than an edit, so ADR-0001 to ADR-0047, accepted before this guard covered docs,
// are excluded as written. Every later ADR is checked.
const LAST_UNGUARDED_ADR = 47;
const ADR_FILE = /^docs\/adr\/(\d{4})-/;

function isGuardedDoc(path: string): boolean {
  if (path.startsWith(FIXTURES_PREFIX)) return false;
  const adr = ADR_FILE.exec(path);
  return adr?.[1] === undefined || Number(adr[1]) > LAST_UNGUARDED_ADR;
}

function trackedDocs(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--', '*.md'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter((path) => path !== '' && isGuardedDoc(path));
}

// Reads comments through the TypeScript parser, so a URL or a regex inside a string or
// a literal is never mistaken for one. Ranges are keyed by position because adjacent
// nodes report the same leading and trailing trivia.
function collectComments(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const ranges = new Map<number, ts.CommentRange>();
  const record = (found: ts.CommentRange[] | undefined): void => {
    for (const range of found ?? []) ranges.set(range.pos, range);
  };
  const visit = (node: ts.Node): void => {
    record(ts.getLeadingCommentRanges(text, node.getFullStart()));
    record(ts.getTrailingCommentRanges(text, node.end));
    node.getChildren(source).forEach(visit);
  };
  visit(source);
  return [...ranges.values()].map((range) => text.slice(range.pos, range.end));
}

// The prose rules for text no dictionary holds: no emojis, no decorative punctuation,
// and no banned filler words. The exclamation mark is left out because Markdown image
// syntax and code comparisons use it.
function proseViolations(text: string): string[] {
  const lower = text.toLowerCase();
  return [
    ...(EMOJI.test(text) ? ['an emoji'] : []),
    ...(DECORATIVE.test(text) ? ['decorative punctuation'] : []),
    ...BANNED.filter((word) => lower.includes(word)).map((word) => `"${word}"`),
  ];
}

// The doc and comment scans parse the whole repository, which takes well under a second
// alone but can pass the default five second budget when the full suite runs in parallel.
const REPOSITORY_SCAN_TIMEOUT_MS = 30_000;

const dictionaries: Record<string, Record<string, string>> = { th, en };

describe('copy tone', () => {
  for (const [locale, dict] of Object.entries(dictionaries)) {
    it(`${locale} copy carries no emojis, decorative punctuation, or exclamation`, () => {
      for (const [key, value] of Object.entries(dict)) {
        expect(EMOJI.test(value), `${key}: ${value}`).toBe(false);
        expect(DECORATIVE.test(value), `${key}: ${value}`).toBe(false);
        expect(value.includes('!'), `${key}: ${value}`).toBe(false);
      }
    });
  }

  it('the English copy uses no banned filler words', () => {
    for (const [key, value] of Object.entries(en)) {
      const lower = value.toLowerCase();
      for (const word of BANNED) {
        expect(lower.includes(word), `${key} contains "${word}"`).toBe(false);
      }
    }
  });

  it('neither dictionary uses a non-canonical Thai term', () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        for (const term of BANNED_THAI) {
          expect(
            value.includes(term),
            `${locale} ${key}: "${value}" uses "${term}"`,
          ).toBe(false);
        }
      }
    }
  });

  // All UI copy goes through the dictionaries, so a banned Thai term in a source file is a
  // hardcoded literal, a composed string or an aria label the dictionary scan cannot see.
  it('no source file hardcodes a non-canonical Thai term', () => {
    const files = collectSourceFiles(SRC_DIR).filter(
      (file) => !file.includes(I18N_DIR) && !/\.test\.tsx?$/.test(file),
    );
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const term of BANNED_THAI) {
        expect(text.includes(term), `${file} uses "${term}"`).toBe(false);
      }
    }
  });

  it(
    'tracked docs follow the prose rules',
    { timeout: REPOSITORY_SCAN_TIMEOUT_MS },
    () => {
      const docs = trackedDocs();
      expect(docs).toContain('README.md');
      for (const doc of docs) {
        readFileSync(doc, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            expect(
              proseViolations(line),
              `${doc}:${String(index + 1)}`,
            ).toEqual([]);
          });
      }
    },
  );

  it(
    'source comments follow the prose rules',
    { timeout: REPOSITORY_SCAN_TIMEOUT_MS },
    () => {
      for (const file of collectSourceFiles(SRC_DIR)) {
        for (const comment of collectComments(file)) {
          expect(proseViolations(comment), `${file}: ${comment}`).toEqual([]);
        }
      }
    },
  );
});
