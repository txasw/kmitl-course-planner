// Starts the replica on the served page and hands its driver to the specs. A term in the
// query, as ?term=2/2569, is the page's term from its first render, as the host fixes the
// term when the page mounts, so KCP never reads the default term first.

import { mountReplica } from '/replica/replica.js';

const term = new URLSearchParams(window.location.search).get('term');
const [semester, year] = term === null ? [] : term.split('/');

window.replica = mountReplica(
  document,
  semester === undefined || year === undefined
    ? {}
    : { term: { semester, year } },
);
