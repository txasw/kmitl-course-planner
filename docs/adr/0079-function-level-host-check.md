# 79. Function level host check

Status: Accepted
Date: 2026-11-26

Builds on ADR-0077, the read only observer on the pre registration page, and ADR-0078, student
initiated fill, whose build gates this decision widens. Reviewed against rule 5, zero trust of
external data, rule 6 as the owner amended it on 2026-11-23, and the API access rules of
Section 4.7.

## Context

The observer and fill run only on a host build KCP was tested against, compared by the exact
pair of script names, `app.<hash>.js` and `chunk-vendors.<hash>.js`, in `TESTED_BUILDS`. The
host deployed three new app builds in the three days after the first tested one:
`app.020e81ed.js` on 2026-11-25 at 04:09 GMT, `app.a1e43722.js` at 09:53 GMT, and
`app.ba450963.js` on 2026-11-26 at 03:21 GMT, all beside the same vendor script. Two touched staff
and payment pages only, and the third changed only the route around the panel. Each time the
helper said the page was a new version and Add for me went dark for every student until a manual
review shipped the new name.

The owner asked on 2026-11-26, translated: "Can't we detect whether the functions we use changed?
Why block as soon as the app changes? There should be other ways to check." The owner had
answered (1A) that when the host changes in a way KCP has not verified, the checklist keeps
working and Add for me stays off until reviewed.

## Decision

### What the check reads

When the page's script names are not an exact tested pair and its vendor script is a tested one,
the helper asks the background worker once per document, sending only the two public names. Each
name is held to its pattern, `^app\.[0-9a-f]{8}\.js$` and `^chunk-vendors\.[0-9a-f]{8}\.js$`, in
the message schema and again in the worker. The worker builds the address itself on
`https://regis.reg.kmitl.ac.th/js/` and never takes an address from the page. It makes one GET
with no cookie, no referrer, and no redirect, with a 20 second timeout and no retry, refuses a
body over 8 MB or one that is not UTF-8, and reads the body as text. It never evaluates it.

### The parts

The worker tokenizes the script and finds, by what each is rather than where it sits, the parts
the companion depends on: the PreRegistration route, its RegistrationHeader, its
RegistrationPeriods, and the mixin it polls the period check with; the PreRegistrationPanel; the
PreRegisAddSubject card with its PatternTable and SubjectDialog children; the grade not announced
dialog inside the card, by the flag that opens it; the PreRegisStepper; the consent, flow chart,
and complete steps; the API client class that holds the host's request instance, whose `get` puts
the function in the query and whose `create` puts it in the body, which the tripwire relies on
(ADR-0078, amendment of 2026-11-26); every method that names a registration write endpoint; and
the labels. The label part is the value in both languages of every message key a part names,
which holds the fixed labels the observer matches, and every clickable registration label exactly
as `scripts/host-labels.mjs` prints it for the denylist, through the same shared reader.

A page component is found by the name its options give it and followed from the call that binds
its options to its render function. Each part's canonical text is its tokens with every binding
labelled by the binding it refers to, not by its letters, so a build that only renames minified
names reads the same, and with each free name followed to its definition in the one module the
host's build hoists its pages into, so a change in a helper a part calls is a change in that part.
A name that stands for another part, the message catalogs, or the host store is written as that
boundary and not followed, so each change shows in the part it belongs to. Each text is hashed
with SHA-256 through the Web Crypto API.

The write endpoints are known only by the SHA-256 of their function names, so no KCP source or
bundle names one and the write name scan of `tests/scripts/write-names.test.ts` stays clean.

### The verdict

The build is verified only when the vendor script is a tested one and every part's fingerprint,
and the set of parts found, equals one recorded tested build's. The recorded table in
`src/lib/regis/fingerprint/recorded.ts` is printed by `scripts/host-fingerprint.mjs` from the
saved bundles with the same extraction the worker runs, so the two never fork. A verified build is
tested for the observer and for fill. Every other outcome keeps the build untested with today's
sentence, as 1A asks: a part that differs or is missing, a script KCP cannot read, a request that
did not complete, and a vendor script KCP was not tested with. While the check runs the observer
waits, since an off reading lasts the document, and fill stays off.

The vendor script stays exact. The actuator relies on how Vue and Vuetify handle an input, a
select change, and a click, and a fingerprint of those parts of a 2.3 MB vendor bundle could not be
made sound.

What was read is kept by the app script's name, in worker memory and in `storage.local` under
`kcp:hostcheck` through a Zod schema, up to eight builds: the part fingerprints, or that the script
could not be read. A content hashed name always serves the same file, so a kept result is never
read again, a mismatch included, and only the comparison runs again, against the table the
extension ships, so an update that records the build turns fill on without another request. A
request that did not complete is kept with its time and tried again only on a visit an hour later.
Concurrent checks of one name share one request. A result of another fingerprint version is
ignored. The plan root and its schema version are untouched.

The exact `TESTED_BUILDS` list stays the fast path and sends nothing. The runtime layer stays as a
second layer on every build: the observer's anchors, labels, and drift strikes, the tripwire, the
per step verification of the host's response, and the actuator refusal latch. In the debug build
the helper shows one line under the untested build bar that names the parts that differ or why
there is no fingerprint; production renders nothing there.

### Why this fits rule 6 and Section 4.7

The request reads a public static asset the page itself just loaded, from the worker, the single
network authority. It carries no student data: no cookie, no referrer, no identity, and only the
script name the page already published. It is no host write and touches no registration endpoint.
It runs once per new build per browser, is never polled and never retried, and is served by the
host's static file server rather than its registration API. Nothing runs in the page's JavaScript
world.

## Alternatives

- **Exact script names only.** Today's gate. Rejected as the only gate because every staff
  redeploy turned fill off for students although nothing fill uses had changed.
- **Runtime DOM checks only.** The anchors and labels can see markup, not what a button's handler
  does or which endpoint a method calls, which is why ADR-0078 required a tested build. Kept as
  the second layer.
- **Inspecting the host from the page's JavaScript world.** Rejected by rule 6 and owner answer
  7B: no extension script runs there without its own ADR, and such a script could reach the
  session.
- **Fingerprinting the whole app script.** Every staff change would flip it, which is the problem
  this solves.
- **A regular expression that replaces short names.** The manual comparisons used one, but it
  cannot tell two bindings that share a letter apart, and it loses the helpers a part calls.
- **Checking on the student's press instead of on arrival.** The press would wait on a request and
  the helper could not say before it whether fill can run.

## Consequences

- A host change in the backend, such as what an endpoint does, is not covered; the tripwire and
  the per step verification of the host's response still stop a run on what the page shows.
- A build that changes a part, as `app.a1e43722.js` changed the route, still needs a review. The
  reviewer runs `node scripts/host-fingerprint.mjs --prove` on the saved bundle, which also fails
  unless each synthetic edit in `probes.ts` changes the part it is in, and records the entry.
- Each new build costs one request of about 1.8 MB per browser, and a check that fails keeps fill
  off for an hour on that browser.
- A host build that splits its pages into chunks, or moves them out of one module, reads as one
  KCP cannot read and stays off.
- The debug build records the fingerprint of KCP's own replica bundle,
  `tests/fixtures/host-fingerprint/app.replica.js`, so the end to end specs can serve it under a
  name KCP was never tested with; production records only the tested host builds.

## Fingerprints of the tested builds

The four tested builds share two fingerprints. `app.454d9e95.js` and `app.020e81ed.js` read the
same in every part, and so do `app.a1e43722.js` and `app.ba450963.js`. The second pair adds the
header, the periods, and the period check, and its route and labels differ from the first; every
other part reads the same in all four. Hashes are shortened here; the table holds them in full.

| Part          | 454d9e95, 020e81ed | a1e43722, ba450963 |
| :------------ | :----------------- | :----------------- |
| route         | 4be570d7           | 84ebeb09           |
| header        | absent             | b5437dad           |
| periods       | absent             | f978b839           |
| periodCheck   | absent             | e64bc851           |
| panel         | d2ae446e           | d2ae446e           |
| addSubject    | bf553712           | bf553712           |
| patternTable  | bc0fff7b           | bc0fff7b           |
| subjectDialog | 695b7657           | 695b7657           |
| stepper       | eec9a04b           | eec9a04b           |
| consent       | 396c475a           | 396c475a           |
| flowChart     | 7a580b7d           | 7a580b7d           |
| complete      | f6ed3d07           | f6ed3d07           |
| gradeDialog   | 8ae273a4           | 8ae273a4           |
| client        | befe3951           | befe3951           |
| writes        | 4566a4d6           | 4566a4d6           |
| labels        | 33a230da           | a5a9e7fb           |

On each of the four bundles, `--prove` shows an added option on every page component, a button of
the add subject card calling another method, an added call in one of its methods, a changed
attribute of the grade not announced dialog, a changed number in the period check and in the API
client, a changed write endpoint name, and a changed English label of the add button each change
the part they are in.

## Tests

Unit tests cover the tokenizer and its failure on unreadable text, the scope labels, the module
definitions and the canonical text with its boundaries, limits, and rename invariance, the
fingerprint of the replica bundle with every probe, a renamed helper, a swapped binding, and a
missing or doubled part, the comparison, the recorded table against `TESTED_BUILDS`, the write
references by digest, the bounded fetch with its timeout, the record with its schema and limit,
the worker check with its fast path, vendor rule, one request per name, kept mismatch, kept
unreadable result, hourly retry, and broken storage, the message and reply schemas, the content
gate and observer health while checking, the content check and its malformed replies, and the
fill run on a verified build. The end to end spec serves the replica under a new name and sees Add
for me fill, serves it with one label changed and sees fill stay off with the labels part named,
serves a script with no parts as one that could not be read, and sees each build read once.

## Revisit triggers

The host changes its bundler or splits its pages into chunks, the vendor script changes, the host
starts serving its scripts from another folder, or the owner asks to cover the vendor bundle.
