// Prints every label the host bundle gives a clickable element in its registration
// dictionaries, in both of the host's languages, for the fill denylist in
// src/features/regis/fill/denylist.ts. It reads the render functions of a saved host
// bundle as text and evaluates none of it: a label is a $t key that is the only text
// child of an element with a click handler, in a registration namespace, and each key is
// resolved in every dictionary block of its namespace. The reading is the one the host
// check fingerprints (ADR-0079), so the two never fork. Run it on a new tested build:
//
//   node scripts/host-labels.mjs path/to/app.<hash>.js
import { readFileSync } from 'node:fs';
import { clickableLabels } from '../src/lib/regis/fingerprint/labels.ts';

const source = readFileSync(process.argv[2] ?? '', 'utf8');
console.log(JSON.stringify(clickableLabels(source), null, 2));
