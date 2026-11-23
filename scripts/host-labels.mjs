// Prints every label the host bundle gives a clickable element, in both of the host's
// languages, for the fill denylist in src/features/regis/fill/denylist.ts. It reads the
// render functions of a saved host bundle as text and evaluates none of it: a label is a
// $t key that is the only text child of an element with a click handler, and each key is
// resolved in every dictionary block of its namespace. Run it on a new tested build:
//
//   node scripts/host-labels.mjs path/to/app.<hash>.js
import { readFileSync } from 'node:fs';

const source = readFileSync(process.argv[2] ?? '', 'utf8');
const CLICKABLE =
  /on:\{click:[^[]{0,400}?\}\},\[\w+\._v\((?:"\s*"\+)?\w+\._s\(\w+\.\$t\("([\w.]+)"\)/g;

function blockEnd(text, start) {
  let depth = 0;
  for (let index = text.indexOf('{', start); index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}' && --depth === 0) return index;
  }
  return text.length;
}

function valuesOf(key) {
  const [namespace, leaf] = key.split('.');
  const found = [];
  for (const match of source.matchAll(
    new RegExp(`[,{]${namespace}:[{]`, 'g'),
  )) {
    const block = source.slice(match.index, blockEnd(source, match.index));
    const value = new RegExp(`[,{]${leaf}:"([^"]{1,60})"`).exec(block);
    if (value) found.push(value[1].trim());
  }
  return found;
}

const keys = new Set([...source.matchAll(CLICKABLE)].map((match) => match[1]));
const labels = new Set([...keys].flatMap(valuesOf));
console.log(JSON.stringify([...labels].sort(), null, 2));
