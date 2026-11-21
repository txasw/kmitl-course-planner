// A layout check for the block names of a grid, the regression guard for names that broke
// one character per line in a narrow day column and for blocks that read as a bare subject
// id. jsdom cannot evaluate the container query that gives a narrow block its name only
// layout, so the check runs in the browser against laid out text. Every block shows its name,
// in full, one type step smaller, or abbreviated (the ADR-0047 amendment of 2026-11-22), so a
// name with no text or one that reads as the eight digit id alone is reported. For every shown
// name it also reports a name the block cuts off without the density fit clamping it, and a
// line that holds a single grapheme of a longer word. A word of one grapheme, such as the 1
// that ends a course name, may sit alone on its line. A name that is not Thai, or a Thai name
// field written with no Thai letter, is held to its word boundaries: any word whose letters run
// over two lines is reported, since a name in Latin capitals breaks with no hyphen. A Thai name
// keeps the browser's dictionary breaks, and a Thai word wider than the whole line may break
// inside. The break form, the last resort that lets a word wider than the line break inside,
// skips the word and grapheme rules and is reported only where its text would fit the line
// unbroken, since the fit should then have stopped at an abbreviated or smaller form.

import type { Locator } from '@playwright/test';

/** The names in the scope that are missing, read as the subject id alone, clip, or strand one
 * grapheme of a word on a line. */
export async function brokenBlockNames(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const problems: string[] = [];
    const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' });
    const words = new Intl.Segmenter('th', { granularity: 'word' });
    for (const name of root.querySelectorAll<HTMLElement>('[data-fit-name]')) {
      const box = name.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const text = name.textContent.trim();
      if (text === '') {
        problems.push('no name text');
        continue;
      }
      if (/^\d{8}$/.test(text)) {
        problems.push(`subject id in place of the name: ${text}`);
        continue;
      }
      const keepWords =
        (name.closest('[lang]')?.getAttribute('lang') ?? 'th') !== 'th' ||
        !/\p{Script=Thai}/u.test(text);
      const clamped = name.style.getPropertyValue('--kcp-name-lines') !== '';
      const frame = name.closest('[data-fit]')?.getBoundingClientRect();
      if (
        !clamped &&
        frame !== undefined &&
        (box.bottom > frame.bottom + 1 || box.right > frame.right + 1)
      ) {
        problems.push(`clipped: ${text}`);
      }
      if (name.dataset.nameForm === 'break') {
        // The break form is the last resort: its text must not fit the line unbroken.
        const wrap = name.style.overflowWrap;
        name.style.overflowWrap = 'normal';
        const fitsWhole = name.scrollWidth <= name.clientWidth;
        name.style.overflowWrap = wrap;
        if (fitsWhole) {
          problems.push(`broken although a shorter form fits: ${text}`);
        }
        continue;
      }
      for (const node of name.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const value = node.textContent ?? '';
        // The top of the line each grapheme sits on, by its index in the text.
        const placed: { index: number; top: number }[] = [];
        for (const { segment, index } of graphemes.segment(value)) {
          if (segment.trim() === '') continue;
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + segment.length);
          const rect = Array.from(range.getClientRects()).find(
            (candidate) => candidate.width > 0,
          );
          if (rect !== undefined) placed.push({ index, top: rect.top });
        }
        // Group the graphemes into lines, a new line wherever the top moves down.
        const lines: number[][] = [];
        let lineTop = Number.NEGATIVE_INFINITY;
        for (const { index, top } of placed) {
          if (top > lineTop + 2) {
            lines.push([]);
            lineTop = top;
          }
          lines[lines.length - 1]?.push(index);
        }
        const wordSpans = Array.from(words.segment(value)).map(
          ({ segment, index }) => ({
            start: index,
            end: index + segment.length,
            graphemes: Array.from(graphemes.segment(segment)).length,
          }),
        );
        if (keepWords) {
          const lineOf = new Map<number, number>();
          lines.forEach((line, number) => {
            for (const index of line) lineOf.set(index, number);
          });
          for (const { segment, index, isWordLike } of words.segment(value)) {
            if (isWordLike !== true) continue;
            const spanned = new Set<number>();
            for (const grapheme of graphemes.segment(segment)) {
              const number = lineOf.get(index + grapheme.index);
              if (number !== undefined) spanned.add(number);
            }
            if (spanned.size > 1) {
              problems.push(`broken inside a word: ${segment} in ${text}`);
            }
          }
        }
        for (const line of lines) {
          const only = line.length === 1 ? line[0] : undefined;
          if (only === undefined) continue;
          const word = wordSpans.find(
            (span) => span.start <= only && only < span.end,
          );
          if (word !== undefined && word.graphemes > 1) {
            problems.push(
              `one grapheme on a line: ${value.slice(word.start, word.end)} in ${text}`,
            );
          }
        }
      }
    }
    return problems;
  });
}
