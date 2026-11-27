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
with no cookie, no referrer, and no redirect, with a 20 second timeout and no retry within the
visit, refuses a
body over 8 MB or one that is not UTF-8, and reads the body as text. It never evaluates it.

### The parts

The worker tokenizes the script and finds, by what each is rather than where it sits, the parts
the companion depends on: the PreRegistration route, its RegistrationHeader, its
RegistrationPeriods, and the mixin it polls the period check with; the PreRegistrationPanel; the
PreRegisAddSubject card with its PatternTable and SubjectDialog children; the grade not announced
dialog inside the card, by the flag that opens it; the PreRegisStepper; the consent, flow chart,
and complete steps; the API client class that holds the host's request instance, whose `get` and
`delete` put the function in the query and whose `create` puts it in the body, so no write address
is the period check's exact address that the tripwire exempts (ADR-0078, amendments of
2026-11-26); every method that names a registration write endpoint; and
the store with every module it takes, the module setup, and the labels. The label part is the
value in both languages of every message key a page part names,
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
It runs once per new build per browser and is never polled. A request that did not complete is
tried again only on a visit an hour later, and a build is read again only after eight newer builds
pushed its kept result out. It is served by the host's static file server rather than its
registration API. It is a request KCP starts by itself on a registration page, an exception to the
quiet mode of ADR-0075, which its amendment of 2026-11-26 records as an open question for the
owner: on arrival, as built, or only on the student's press. Nothing runs in the page's JavaScript
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

The four tested builds share two fingerprints, at fingerprint version 3. The amendment on the App
shell's menu data below gives the table at version 4. `app.454d9e95.js` and
`app.020e81ed.js` read the same in every part, and so do `app.a1e43722.js` and `app.ba450963.js`.
The second pair adds the header, the periods, and the period check, and its route and labels differ
from the first; every other part, the store and the setup included, reads the same in all four.
Hashes are shortened here; the table holds them in full.

| Part          | 454d9e95, 020e81ed | a1e43722, ba450963 |
| :------------ | :----------------- | :----------------- |
| route         | d28d385c           | 976dfe43           |
| header        | absent             | d8ff3da2           |
| periods       | absent             | 5f915084           |
| panel         | 700d0271           | 700d0271           |
| addSubject    | 04f1ed02           | 04f1ed02           |
| patternTable  | 7b3d4fdf           | 7b3d4fdf           |
| subjectDialog | e1deeec5           | e1deeec5           |
| stepper       | 17a9a9ff           | 17a9a9ff           |
| consent       | 1a07dfcc           | 1a07dfcc           |
| flowChart     | 7e71a8bc           | 7e71a8bc           |
| complete      | 9b5de63e           | 9b5de63e           |
| gradeDialog   | 1aeed084           | 1aeed084           |
| periodCheck   | absent             | bd0e9916           |
| client        | c101a0af           | c101a0af           |
| writes        | 4566a4d6           | 4566a4d6           |
| store         | ebbcfaee           | ebbcfaee           |
| setup         | 4d540e7e           | 4d540e7e           |
| labels        | 33a230da           | a5a9e7fb           |

On each of the four bundles, `--prove` shows an added option on every page component, a button of
the add subject card calling another method, an added call in one of its methods, a changed
attribute of the grade not announced dialog, a changed number in the period check and in the API
client, a changed write endpoint name, a plugin and an action call added to the store, a global
mixin added as a statement and inside a declaration, the pre registration route moved, and a changed
English label of the add button each change the part they are in.

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

## Amendment, 2026-11-26: review fixes to the host check

A review found host code the parts did not reach, and three smaller faults.

- **The store and the module setup.** Every part named the host store and stopped there, and
  nothing read the store's modules, the plugins and global mixins installed as the module loads,
  the router guard, or the root instance with the App, its bar, and its drawer. A store plugin that
  posts on every mutation, a global mixin that watches the subject list, and an edited token action,
  which the API client dispatches on every request, each read as verified on `app.a1e43722.js`. Two
  parts now cover that code. The store part follows the one store definition with every module it
  takes. The setup part reads every top level statement of the module and every top level
  declaration whose value installs a mixin, a plugin, a directive, a filter, a guard, a store hook,
  or a root as it is made, and the route entries that name a page part. The route table and the
  lists of route names the guard checks are boundaries of the setup, since the staff pages they list
  change often; reading them would turn fill off on every staff redeploy again, and what the guard
  does with them is in the setup. The store and the setup name no label KCP matches, so their message
  keys stay out of the label part. Each new part has probes, and both hold on all four bundles.
- **Short globals.** A free name under four letters that the module does not define, a global or a
  parameter of the bundle wrapper, took a label by first use and had no line saying what it was, so
  `new Set` and `new Map`, or `top` and `URL`, read the same. Every such name is now written as
  written with a mark that keeps it apart from the binding labels.
- **A reader fault.** An exception from the reader was kept as a failed request, so the same
  script, whose name names its content, was downloaded again every hour. It is now kept as
  unreadable; a release that changes the reader moves the fingerprint version, which drops it.
- **While the check runs.** The fill gate has a checking state with its own sentence, recorded in
  the review amendment of ADR-0078.

The fingerprint version moved to 3, the tested builds and the replica were recorded again, and
`app.ba450963.js` still reads the same as `app.a1e43722.js` in every part.

## Amendment, 2026-11-26: the App shell's menu data

The host deployed `app.2ef67281.js` on 2026-11-26 at 09:38 GMT, and the check read it as a mismatch
in the setup part only. The review (ADR-0077, amendment of that day) found the only change in the
navigation drawer of the App shell: its menu data was regrouped, and the drawer's scoped style id,
which vue-loader derives from the component's file, changed with it. The setup reaches the App, its
bar, its drawer, and its footer through the root instance, so every staff menu change turned Add
for me off, and the owner asked that host changes unrelated to the companion stop doing so.

- **The boundary.** Within the App and the bar, drawer, and footer it registers under those keys,
  found from the App by name and its `components` option (`shell.ts`), the value the data function
  returns is a boundary: each pure static literal in it is written as one word, and so is each
  shell component's scoped style id. A pure static literal is an object or an array whose entries
  are only strings, numbers, booleans, null, templates with no substitution, spreads of pure data,
  nested pure data, and a choice between pure data on a module constant, a name the module defines
  once as pure data with no name in it, as the minifier writes the build flag the drawer's staff
  entries choose on (`pureData.ts`). A data entry that holds a function, a call, a member access,
  a getter, a computed or shorthand key, or any other name is read in full. Only a data function
  that takes no parameter is read this way, so every name in its value is the module's.
- **What stays.** Every other option, method, computed value, watcher, hook, render function,
  handler, and directive of the shell is read as before, with every literal in it, including the
  arrays a method passes to the store and the attributes a render function sets. Every component
  outside these four, every global mixin and plugin, and every page part, the store, the client,
  the writes, and the labels are read as before; no other part takes the boundary.
- **The version.** The fingerprint version moved to 4, and every tested build and the replica were
  recorded again. The replica gained an App bar, a drawer with menu data and a choice on a build
  flag, and a footer, so the unit tests see the boundary.
- **Proof.** Fingerprinted against the records of the four earlier builds alone, `app.2ef67281.js`
  matched the recorded `app.a1e43722.js` before its own record was added; it joins that entry and
  the exact tested list. On all five bundles and the replica, `--prove` shows every earlier probe
  still changes the part it is in, the store plugin, the global mixins, and the edited token action
  among them, and three new probes change the setup: a function added to an entry of the drawer's
  menu data, a drawer method that calls the API, and a click handler added to the app bar. Four
  neutral edits leave every part as it was: the drawer's first two menu entries swapped, an entry
  with a new label added, and a changed label and a changed icon. The script fails when a neutral
  edit changes any part.

| Part          | 454d9e95, 020e81ed | a1e43722, ba450963, 2ef67281 |
| :------------ | :----------------- | :--------------------------- |
| route         | d28d385c           | 976dfe43                     |
| header        | absent             | d8ff3da2                     |
| periods       | absent             | 5f915084                     |
| panel         | 700d0271           | 700d0271                     |
| addSubject    | 04f1ed02           | 04f1ed02                     |
| patternTable  | 7b3d4fdf           | 7b3d4fdf                     |
| subjectDialog | e1deeec5           | e1deeec5                     |
| stepper       | 17a9a9ff           | 17a9a9ff                     |
| consent       | 1a07dfcc           | 1a07dfcc                     |
| flowChart     | 7e71a8bc           | 7e71a8bc                     |
| complete      | 9b5de63e           | 9b5de63e                     |
| gradeDialog   | 1aeed084           | 1aeed084                     |
| periodCheck   | absent             | bd0e9916                     |
| client        | c101a0af           | c101a0af                     |
| writes        | 4566a4d6           | 4566a4d6                     |
| store         | ebbcfaee           | ebbcfaee                     |
| setup         | e804e493           | e804e493                     |
| labels        | 33a230da           | a5a9e7fb                     |

Only the setup hash moved from version 3. A staff menu change in the shell now verifies; a change
to how the shell behaves, or to anything a page part reaches, still needs a review.

**Where the request runs.** The helper asks the worker only while the host is on
`#/pre_registration`, the one page whose observer and fill read the verdict. The function that sends
the message refuses on any other route as well as the hook that calls it, so no other page, the
regular registration page and the planner included, makes the request.

## Amendment, 2026-11-27: review fixes to the shell boundary and the setup

A read only review of the shell boundary found that pure literals are not inert in a Vue page, and
that the setup missed declarations that run code as the module loads. Each fix below has a probe or
a unit test, and `app.2ef67281.js` still reads as `app.a1e43722.js`.

- **The bar, the App, and the footer.** The app bar binds its `attrs` data onto its login button,
  so an inline handler there runs as an attribute, with no click, and a `javascript:` link there
  is one. The data of the App, the bar, and the footer has never changed, so it is read in full
  again. The boundary is the drawer alone.
- **Data keys.** Vue sets a data key over a method or a computed value of the same name, so a key
  such as `student_id` beside the menu would decide what the drawer requests. The boundary is now
  the value of `nav` in a drawer data value with no other key, and the key stays in the canonical
  text. Any other key is read in full.
- **The drawer's vocabulary.** Any pure literal passed before, but the drawer's render hands `href`
  and `to` to Vuetify and the router. Each menu entry is now checked key by key against what the
  drawer has always held (`drawerMenu.ts`, which replaces `pureData.ts`): `to` as a path of lower
  case letters, digits, and underscores or as `{name}` with a route name, `href` on
  `https://www.reg.kmitl.ac.th/storage/`, `target` as `_blank`, a message key, an `mdi-` icon,
  permission names or null, the condition as a boolean or null, `active` and `noti_badge` as
  booleans, `action` as login or logout, and `subItems` of entries that follow the same rules. A
  choice stands only on a module constant written as a boolean, and a spread only of an array
  literal, since code that runs anywhere could fill a named constant at run time. An entry with
  any other key or value is read in full, so a regroup or a moved entry stays neutral and a
  changed entry turns fill off.
- **Actions.** The word the menu is written as counts its login and logout actions, so a logout
  action moved onto the homepage item is a change.
- **Declarations.** A top level declarator is now read whenever its value makes a call, a `new`,
  a tagged template, a write, or a delete outside the functions it defines (`effects.ts`), so a
  document listener or a request made in a comma expression is a change. Left out are a webpack
  require and its default export getter, the call that binds a component with the App's own
  binding, a `new` of a service class whose construction runs only `super(...)` up to the API
  client, and a call to a helper a running pattern binds, such as `mapFields`. Each declarator is
  read alone, and the names a pattern binds are written as one word, so the staff services and
  pages that share a statement stay out. The setup now also reads the router, the i18n instance,
  the keycloak client, the four `mapFields` helpers, and the staff constant lists built with
  `sort`; a change to one of those lists turns fill off until a review.
- **Not covered.** The page components KCP does not depend on, such as Home and MainMenu, are
  still read by no part. A hook one of them installs as it is created, which a student meets in
  the same session before pre registration, reads as a tested build. A digest of the global effects
  of every student page was considered and left for the owner, since it trades directly against
  staff redeploys turning fill off. The CSS bundle is not fingerprinted; fill clicks elements, not
  screen positions, so a style cannot redirect a fill click. The drawer's scoped style id stays a
  boundary, since no observer or fill code keys on scope ids.

The fingerprint version moved to 5, and every tested build and the replica were recorded again.
`--prove` on all five bundles and the replica shows each earlier probe still changes its part, and
five new probes change the setup: an inline handler in the app bar's data, a key beside the
drawer's menu, a `javascript:` link in a menu entry, a logout action added to a menu entry, and a
document listener added inside a declaration. The four neutral edits still change no part.

| Part          | 454d9e95, 020e81ed | a1e43722, ba450963, 2ef67281 |
| :------------ | :----------------- | :--------------------------- |
| route         | d28d385c           | 976dfe43                     |
| header        | absent             | d8ff3da2                     |
| periods       | absent             | 5f915084                     |
| panel         | 700d0271           | 700d0271                     |
| addSubject    | 04f1ed02           | 04f1ed02                     |
| patternTable  | 7b3d4fdf           | 7b3d4fdf                     |
| subjectDialog | e1deeec5           | e1deeec5                     |
| stepper       | 17a9a9ff           | 17a9a9ff                     |
| consent       | 1a07dfcc           | 1a07dfcc                     |
| flowChart     | 7e71a8bc           | 7e71a8bc                     |
| complete      | 9b5de63e           | 9b5de63e                     |
| gradeDialog   | 1aeed084           | 1aeed084                     |
| periodCheck   | absent             | bd0e9916                     |
| client        | c101a0af           | c101a0af                     |
| writes        | 4566a4d6           | 4566a4d6                     |
| store         | ebbcfaee           | ebbcfaee                     |
| setup         | 4a05338b           | 4a05338b                     |
| labels        | 33a230da           | a5a9e7fb                     |

## Amendment, 2026-11-27: the owner's rulings on timing and the observer

The owner answered the two questions this record left open on 2026-11-27.

- **Timing, answer 4A.** The check runs on arrival at `#/pre_registration`, as built. ADR-0075
  records the same ruling as the one exception to its quiet mode.
- **An unverified build, answer 5A.** When the check finds a change in a part KCP uses, or cannot
  finish, the observer stays off as well as fill. The checklist shows no status from the page,
  every subject as still to add under the bar that names a new host build, and KCP reads nothing
  on the page until a review records the build. Keeping the observer
  on while only fill is off was the rejected alternative, since the observer's anchors are the
  parts that changed.

The digest of every student page noted as not covered in the amendment above was not adopted. A
hook a page KCP does not depend on installs is the host's own code on its own page, and during a
run the tripwire still stops at the first host API call it did not expect, so such a hook cannot
turn a fill press into a write that goes unseen.
