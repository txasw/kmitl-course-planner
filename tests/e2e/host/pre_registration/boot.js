// Starts the replica on the served page and hands its driver to the specs. A term in the
// query, as ?term=2/2569, is the page's term from its first render, as the host fixes the
// term when the page mounts, so KCP never reads the default term first. A ?wide query
// makes the page wider than a phone screen, so a spec can check that the helper stays on
// the part of the page the screen shows.

import { mountReplica } from '/replica/replica.js';

const query = new URLSearchParams(window.location.search);
const term = query.get('term');
if (query.has('wide')) document.body.style.minWidth = '497px';
const [semester, year] = term === null ? [] : term.split('/');

window.replica = mountReplica(
  document,
  semester === undefined || year === undefined
    ? {}
    : { term: { semester, year } },
);
