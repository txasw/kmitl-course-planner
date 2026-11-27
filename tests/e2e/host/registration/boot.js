// Starts the regular registration replica on the served page and hands its driver to the
// specs. A ?state query picks the page state, REGIS, SUMMARY_REGIS, or closed, and a
// ?term query, as ?term=2/2569, the term the header shows.

import { mountRegistration } from '/replica/registration/replica.js';

const query = new URLSearchParams(window.location.search);
const term = query.get('term');
const [semester, year] = term === null ? [] : term.split('/');

window.registrationReplica = mountRegistration(document, {
  state: query.get('state') ?? 'REGIS',
  ...(semester === undefined || year === undefined
    ? {}
    : { term: { semester, year } }),
});
