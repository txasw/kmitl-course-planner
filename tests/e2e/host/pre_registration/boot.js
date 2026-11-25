// Starts the replica on the served page and hands its driver to the specs. A term in the
// query, as ?term=2/2569, is the page's term from its first render, as the host fixes the
// term when the page mounts, so KCP never reads the default term first. A ?wide query
// makes the page wider than a phone screen, so a spec can check that the helper stays on
// the part of the page the screen shows. Served as the app script of a build whose route
// the replica knows, it renders that build's route around the panel, and a ?poll query
// sets how often its period check runs, in milliseconds, 0 for only on focus. A ?loading
// query holds the first render for that many milliseconds, as the live page loads.

import { ROUTE_BUILDS, mountReplica } from '/replica/replica.js';

const query = new URLSearchParams(window.location.search);
const term = query.get('term');
if (query.has('wide')) document.body.style.minWidth = '497px';
const [semester, year] = term === null ? [] : term.split('/');
const build = /\/app\.([0-9a-f]{8})\.js$/.exec(
  new URL(import.meta.url).pathname,
);
const route = ROUTE_BUILDS.find((name) => name === build?.[1]) ?? null;
const poll = query.get('poll');
const loading = query.get('loading');

window.replica = mountReplica(
  document,
  semester === undefined || year === undefined
    ? {}
    : { term: { semester, year } },
  {
    route,
    ...(poll === null ? {} : { poll: Number(poll) }),
    ...(loading === null ? {} : { loading: Number(loading) }),
  },
);
