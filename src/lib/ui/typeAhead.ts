// The first letter match of a menu's type-ahead. Thai writes the vowels เ แ โ ใ ไ before
// the consonant they follow in speech, so a student looking for เปิดตารางเรียน types ป. A
// name matches the typed character at its start, or right after one such leading vowel.

const LEADING_VOWEL = /^[เแโใไ]/u;

/** Whether a menu item name starts with the typed character, past a Thai leading vowel. */
export function startsWithTyped(name: string, typed: string): boolean {
  return (
    name.startsWith(typed) || name.replace(LEADING_VOWEL, '').startsWith(typed)
  );
}
