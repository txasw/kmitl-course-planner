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
});
