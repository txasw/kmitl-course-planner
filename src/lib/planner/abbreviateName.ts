// The abbreviated forms of a subject name in Latin script, the third name form of a placed block
// (the ADR-0047 amendment of 2026-11-22). A block name wraps only between its words, so where one
// word is wider than its line the name steps one type size smaller and then, for a name in Latin
// script, through these forms, each shorter than the one before, until its widest word fits. The
// name never gives way to the subject id: the abbreviation keeps every word in its place, so the
// block still reads as its course.
//
// The rule, word by word: a word of three letters or fewer is kept whole, so a numeral such as II
// and the short joiners AND, OF, FOR, TO, IN, and THE always read in full, and the longer joiners
// WITH, INTO, FROM, and ONTO are kept whole too, since a cut joiner reads as noise, as is a capital
// Roman numeral to XXXIX, since a cut VIII reads VI, a different numeral. Every other word is cut
// to at most a cap of letters followed by a period, and the cut moves back past any vowel it would
// end on, as a printed abbreviation does: COMPUTER at a cap of five reads COMP. A word is cut only
// where the cut form is shorter than the word. The forms start from a cap that shortens only the
// longest words by one letter and lower the cap one letter at a time down to two, so the first form
// that fits is the least shortened one. A name with any Thai letter has no forms, since Thai keeps
// its dictionary breaks and a cut Thai word does not read as an abbreviation.

/** Words kept whole at every cap, beyond those of three letters or fewer. */
const KEPT_JOINERS: ReadonlySet<string> = new Set([
  'WITH',
  'INTO',
  'FROM',
  'ONTO',
]);

/** The longest word kept whole whatever the cap. */
const SHORT_WORD_LETTERS = 3;

/** The fewest letters a cut word keeps before its period. */
const MIN_CAP = 2;

/** A word in Latin letters, an inner apostrophe kept, as in WOMEN'S. */
const LATIN_WORD = /\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*/gu;

const THAI_LETTER = /\p{Script=Thai}/u;

const TRAILING_VOWELS = /[AEIOUaeiou'’]+$/u;

/** A capital Roman numeral up to XXXIX, the range a course sequence reaches. */
const ROMAN_NUMERAL = /^X{0,3}(?:IX|IV|V?I{0,3})$/u;

function keptWhole(word: string): boolean {
  return (
    word.length <= SHORT_WORD_LETTERS ||
    KEPT_JOINERS.has(word.toUpperCase()) ||
    ROMAN_NUMERAL.test(word)
  );
}

/** One word at a cap: whole, or its first letters to the cap, back past a final vowel, with a
 * period, whichever is shorter. */
function cutWord(word: string, cap: number): string {
  if (keptWhole(word) || word.length <= cap + 1) {
    return word;
  }
  const head = word.slice(0, cap);
  const trimmed = head.replace(TRAILING_VOWELS, '');
  const stem = trimmed.length >= MIN_CAP ? trimmed : head.slice(0, MIN_CAP);
  return `${stem}.`;
}

/** The name with every word cut to a cap. */
function atCap(name: string, cap: number): string {
  return name.replace(LATIN_WORD, (word) => cutWord(word, cap));
}

/** The longest word the cut can shorten, in letters, or zero when none can be. */
function longestCuttable(name: string): number {
  let longest = 0;
  for (const [word] of name.matchAll(LATIN_WORD)) {
    if (!keptWhole(word)) {
      longest = Math.max(longest, word.length);
    }
  }
  return longest;
}

/** The abbreviated forms of a name, least shortened first, each shorter than the form before it.
 * Empty for a name with a Thai letter or with no word the rule can cut. */
export function abbreviationSteps(name: string): string[] {
  if (THAI_LETTER.test(name)) {
    return [];
  }
  const steps: string[] = [];
  let previous = name;
  for (let cap = longestCuttable(name) - 2; cap >= MIN_CAP; cap -= 1) {
    const form = atCap(name, cap);
    if (form !== previous) {
      steps.push(form);
      previous = form;
    }
  }
  return steps;
}
