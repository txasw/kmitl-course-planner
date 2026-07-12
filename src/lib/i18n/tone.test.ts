import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import th from './th.json';
import en from './en.json';

// Guards the Section 2 tone rules on every rendered string: no emojis, no decorative
// punctuation such as em or en dashes, arrows, or symbol bullets, no exclamation marks,
// and no LLM filler words. Both dictionaries are checked for the punctuation and emoji
// rules; the banned word list is English, so it runs against the English copy. The emoji
// test covers pictographs, flag pairs, and the emoji presentation selector so a sequence
// emoji is caught, not only a lone pictograph.

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

// All UI copy goes through the dictionaries, so a banned Thai term in a source file is a
// hardcoded literal, a composed string or an aria label the dictionary scan cannot see.
function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}
const SRC_DIR = resolve(process.cwd(), 'src');
const I18N_DIR = join('lib', 'i18n');

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

  it('no source file hardcodes a non-canonical Thai term', () => {
    const files = collectSourceFiles(SRC_DIR).filter(
      (file) => !file.includes(I18N_DIR),
    );
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const term of BANNED_THAI) {
        expect(text.includes(term), `${file} uses "${term}"`).toBe(false);
      }
    }
  });
});
