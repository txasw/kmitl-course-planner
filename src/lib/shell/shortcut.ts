// Turns the shortcut string the commands API reports into words for the shortcut
// hint. Chrome on macOS reports modifier keys as symbols run together, such as the
// shift and option symbols before P, and section 2 of the brief allows no symbols as
// punctuation in copy, so each symbol becomes its key name and the keys join with a
// plus sign. A value with nothing usable, or one too long for a one line hint, becomes
// null, and the hint is then hidden rather than shown wrong.

/** The longest shortcut the hint shows; anything longer is not a real key chord. */
export const SHORTCUT_MAX_LENGTH = 40;

// The macOS symbols Chrome uses for modifier and arrow keys.
const SYMBOL_WORDS: Readonly<Record<string, string>> = {
  '⌘': 'Command',
  '⌥': 'Option',
  '⇧': 'Shift',
  '⌃': 'Ctrl',
  '↑': 'Up',
  '↓': 'Down',
  '←': 'Left',
  '→': 'Right',
};

// The manifest form names the macOS control key MacCtrl; the hint says Ctrl.
const KEY_WORDS: Readonly<Record<string, string>> = { MacCtrl: 'Ctrl' };

// Anything left after the symbols are spelled out must be plain printable ASCII.
const PLAIN_KEY = /^[\x21-\x7E]+$/;

export function formatShortcut(raw: string | null): string | null {
  if (raw === null) return null;
  const spelled = Array.from(raw, (char) => {
    const word = SYMBOL_WORDS[char];
    return word === undefined ? char : `+${word}+`;
  }).join('');
  const keys = spelled
    .split('+')
    .map((key) => key.trim())
    .filter((key) => key !== '')
    .map((key) => KEY_WORDS[key] ?? key);
  if (keys.length === 0 || !keys.every((key) => PLAIN_KEY.test(key))) {
    return null;
  }
  const formatted = keys.join('+');
  return formatted.length > SHORTCUT_MAX_LENGTH ? null : formatted;
}
