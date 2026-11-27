# 77. Read only observer on the pre registration page

Status: Accepted
Date: 2026-11-23

Builds on ADR-0075, quiet mode on the registration pages, and ADR-0076, the registration helper
companion, whose checklist so far counts only the marks the student sets by hand. Reviewed
against rule 5, zero trust of external data, and rule 6 as the owner amended it on 2026-11-23,
which lets KCP read a fixed allowlist of rendered course elements on the registration pages, in
memory only, from the isolated world.

## Context

On registration morning a student adds each planned subject on the host's pre registration page
and then marks it in the checklist by hand. The page already shows what the checklist needs: the
list of subjects added so far with their section codes, the add card's answer to the subject the
student just typed, the dialog that says a prerequisite grade is not out yet, the toasts that
refuse a subject, and, after submitting, the result of each subject. Reading these lets the rows
tick themselves.

The page is a logged in view. It carries the student's id and name in its header, the host
keeps a session token in the page's web storage and sometimes in the address, and its toasts
can print server messages verbatim. A staff member can open the same page on behalf of a
student. And on that morning the registrar can least take extra load, so the reading must add
no request.

The owner ruled on the questions this raised on 2026-11-23: stop at the first problem (3A); no
script in the page's own JavaScript world (7B); the observer and the later fill gated to the
host builds KCP was tested against, `app.454d9e95.js` with `chunk-vendors.7ab4925e.js` (20A);
no remote kill switch (14A); the same behaviour on the phone (23A); and a read only count line
beside the host's confirm dialog when the page list differs from the plan (22A).

## Decision

**What is read.** `features/regis/host/hostDom.ts` is the only module that reads the host page.
It finds, by the structure and the fixed labels of the host's render functions and never by
colour alone: the add card by its heading with the early span beside it, the list table by its
eight header cells and their classes, the add row after the spacer row and the practice row
after it, the credit box by its two labelled lines, the result card on the complete step, the
stepper by its three labels, the term column of the panel header, the open dialog by its title,
and the toasts in their container. It projects only course facts into the schema in
`lib/regis/hostObservation.ts`: subject ids, section codes with the curriculum suffix the host
adds, lecture or practice from the chip, the card status (empty, typing, searching, offered,
refused, already listed, or entered), the row colour, the credits, the step, the term, a dialog
as its kind with the prerequisite subject ids of the grade not announced dialog, a toast as its
kind with the planned subject id it names, and the result of each subject. The schema has no
free text field. A toast's text is classified and dropped in the function that reads it, a
number is kept only when it is a planned subject id, and the student id and name columns of the
header are never read. Every projection passes Zod before it reaches state, and it is held in
memory only, in `features/regis/host/hostStore.ts`.

**When it reads.** On `#/pre_registration` only, the observer reads the page on arrival and again
150 ms after the watched roots settle, through one MutationObserver scoped to the registration
panel (or the app root until the panel shows), the app root's direct children where the host
attaches its dialogs, each dialog's class, and the toast container. It sends no request, writes
nothing into the page, dispatches no event, calls no host code, and stores nothing.

**Health.** `lib/regis/observerHealth.ts` is one pure transition. A host build outside the tested
list, or the staff surrogate key present in the page's session store, turns the observer off for
the document. A page that shows none of the anchors yet is waiting. A page whose anchors do not
read as the contract says is degraded and the reading is dropped whole; three in a row turn the
observer off. Whenever it is degraded or off, each subject keeps the last status the page showed
in this visit, marked stale, a page never read shows every subject as still to add, and the
helper says why in one line. The surrogate check, in `features/regis/host/surrogate.ts`, is the one
read of the page's web storage in KCP: whether one key is present, never its value, and a store
that cannot be read counts as present.

**The checklist.** `deriveChecklist` takes the healthy observation and derives each row's page
state in `lib/regis/observedRow.ts`, matching by subject id, section code, and kind, half for half
for a pair: not on the list, on the list as planned, on the list with another section, refused by
a toast, and on the complete step submitted and waiting, granted, not granted, or not submitted.
The grade not announced dialog's prerequisite ids are kept for the subject in the add field until
the page reloads, so a subject that reaches the list after the dialog reads as conditional with
those ids. The page term replaces the student's own comparison, and a page of another term puts
every row in the term mismatch state with no page state. Subjects the page lists that the plan
does not hold are named. The student's own mark overrides the page state and both stay in view;
the status select offers to follow the page when no mark is set.

**The count line.** While the host's confirm dialog is open and the page list differs from the
plan, a line above the dialog says how many planned subjects the page holds. It has no control,
takes no focus and no pointer, and is a polite status region added to the live region inventory
of ADR-0048.

**Guards.** ESLint holds `features/regis`, `lib/regis`, and the content entry to reading: no
`dispatchEvent`, `click`, `submit`, `requestSubmit`, `focus`, or `setAttribute` call, no write to
`value`, `checked`, `selected`, or the text of a node, and no event constructed. The host reading
modules may not import the storage, the worker messaging, the logger, or the diagnostics. A test
asserts each rule fires where it must. The contract in `lib/regis/hostContract.ts` is checked
against a shape fixture of the tested build's keys, classes, and labels, which holds no host code
and no values.

**Replica.** `tests/e2e/host/pre_registration/` is a static replica of the host panel in plain
DOM code, written from KCP's own reading of the render functions, with placeholder identity. It
reproduces the Vuetify 2.7.2 markup the observer anchors on, is driven by the specs and the unit
tests, counts every press of a host control and every untrusted event aimed at the page, and is
served on the regis origin by the mock server under the tested build's script names or an
untested one. Because a raw capture would hold a student's identity, this reconstructed fixture is
the one exception to captured fixtures for host markup.

## Alternatives

- **Read the component state from the page's JavaScript world.** It would give teach table ids
  directly, but it runs in the realm that holds the session token, needs its own manifest entry,
  and the owner ruled it out for now (7B). Rejected.
- **Read the whole page text.** Simpler, but it would read the student's id and name and every
  server message. Rejected in favour of the structural allowlist.
- **Run on any host build while the anchors are found.** Structure alone cannot see a change in
  what the page means, and the owner chose the tested build gate (20A). Rejected; a host redeploy
  leaves the checklist with no status from the page until a release carries the new names.
- **Keep observing while degraded and show partial states.** A half read page could tick a row it
  should not. Rejected; the whole reading is dropped.

## Consequences

- Rows tick themselves on the tested host build; on any other build, in a surrogate session, or on
  a drifting page, the checklist works exactly as ADR-0076 shipped it.
- Being on the host list is never called registered; only the complete step's result says so.
- Nothing read from the page is stored, logged, or sent, and the page gets no request from KCP.
- The package grows by the reader, the health machine, and their strings, recorded with the budget
  raise.
- Regular registration keeps the companion without reading until a read only live inspection is
  recorded in its own decision record.
- A host redeploy turns the observer off until the tested build list is updated in a release.

## Amendment, 2026-11-24: the observer is the only source of status

With the helper card of the ADR-0076 amendment, the observer's reading is the only thing that sets a
subject's status; there is no manual mark to override it. Each subject reads as not added, added as
planned, another section, conditional, or refused from the page, on the complete step as submitted
or as not in the submitted list (the amendment of 2026-11-27 of ADR-0076), and full or clash from a
fill stop. While the observer is degraded or off, each subject keeps the last status the page showed
in this visit, drawn as stale, and the card shows a page unreadable bar with Check again, which
starts the reading over; the health machine still keeps an off observer off for the document.
Nothing read is stored, and the count line beside the host's confirm dialog stays.

## Amendment, 2026-11-25: Check again revives a drifted page, and the redeploy of that day

**Check again.** An observer that three drifted readings turned off no longer stays off for the
whole document. A student's Check again starts it over from the initial state, and each run of
readings is still bounded by the three strikes, so a page that keeps drifting turns off again after
three more. The press is the only way back: nothing restarts the observer on its own. A staff
session and a host build outside the tested list still keep it off for the document, since no
reading within it can change either, and the helper offers no Check again for them. There is no
cap per document on how often the student may ask: the bound is per press, three drifted readings
after each, and a new planned set starts the reading over the same way. This never lets add for me
act on a drifted page, since the fill engine reads the page itself, stops on a reading it does not
recognise, and stays blocked while the observer waits for its first reading after a press. When a
reading can help, the whole unreadable bar is one press with Check again in its visible text, and
the more menu holds the same item; when none can, the bar is plain with no control, and on an
untested build it says the registration page was updated and to enter the list by hand.

**Tested builds.** The host redeployed its app bundle on 2026-11-25 at 04:09 GMT as
`app.020e81ed.js` beside the same `chunk-vendors.7ab4925e.js`, which turned the observer and fill
off everywhere. The new bundle was compared with the tested one with its minified names
normalised: the add subject card, the stepper, the panel, and the complete step render the same,
every host label in the contract appears as often, and so does every reference to a registration
write endpoint; the deploy changed staff and payment pages only. The pair is added to the tested
list, which keeps the exact two name gate of ruling 20A. A gate on the vendor bundle alone was
considered and not taken here, since it would also accept an app change that structure and labels
cannot see; it is left for the owner to decide.

**The page term.** The term the header shows now chooses which plan the helper follows (ADR-0076
amendment of this date), so the store keeps the last term the header showed through readings that
drift or degrade, in memory only, and forgets it when the student leaves the page. A new planned
set or a Check again starts the reading over and keeps it. A page of another term than the
helper's plan can then only arise before the term is read, so the term mismatch state stays as a
guard rather than the usual answer. On a host build outside the tested list the term is not read,
and the helper shows the active plan.

## Amendment, 2026-11-25: the polling route of app.a1e43722, and a bound on readings

**Tested builds.** The host deployed `app.a1e43722.js` on 2026-11-25 at 09:53 GMT beside the same
`chunk-vendors.7ab4925e.js`. Compared with both tested builds with the minified names normalised,
the add subject card, the stepper, the panel, the complete, consent, and flow chart steps, the
grade not announced dialog with its one acknowledgement, every host label in the contract, every
reference to a registration write endpoint, and the surrogate key are the same, so the pair joins
the tested list under the exact two name gate of ruling 20A. The `PreRegistration` route around the
panel changed in three ways. A `RegistrationHeader` replaces the card title with an h1 and a
subtitle h2 of the semester over the year, which the card search passes over because its text is
not a heading label. A `RegistrationPeriods` section above the panel shows the period's dates and a
countdown that rewrites its digits every second. And the period flags, which the route reads to
decide whether the panel is mounted, are now set by a check of `check-registration-datetime` that
runs every 60 s, on a window focus, on a visibility change, and when the countdown passes a
boundary, so the panel can unmount and mount again while the page stays open, with no navigation.

**The bound on readings.** Before this build only a navigation could add or remove the panel, and
while it was absent the observer watched the whole app root for text and attribute changes. The
countdown would have read the page once a second for as long as it stayed open, so the watch now
lives in `features/regis/host/watchPage.ts` with a stated bound. While the page shows no panel,
whether the last reading found none of the anchors or found a page it could not read, the watch
sees only elements added or removed under the app root, and two readings are at least 1000 ms
apart, so text the page rewrites in place reads nothing and no change of the
page can read it more than once a second. While the panel shows, the watch keeps to the panel's
subtree, the children of each of its ancestors up to the app root, the app root's children, each
dialog's class, and the toast container, with a reading 150 ms after they settle; the countdown
sits outside all of them. Unit tests on fake timers hold the countdown at no reading over thirty
seconds on either side of the panel, and a page that adds an element every 200 ms at no more than
one reading a second.

**The panel leaving.** The ancestors' children are watched so that the host removing the panel from
its card, which changes no child of the app root when no dialog was ever opened, is read at once.
The reading is absent, which the health machine treats as waiting, not as drift: each subject
reads as not added, since no list is on the page, the helper offers no live Add for me since the
page is not on the choose subjects step, and nothing is acted on. When the period opens again the panel mounts from
its own empty data, and the next reading after the gap reads it with no navigation and no press.

**Replica.** Served under the script name `app.a1e43722.js`, the replica renders that build's route
around the panel from its render functions: the route card, the header, the periods with a
countdown patched in place, the panel or the page info, a period change that unmounts the panel
with its dialogs or mounts it again from empty data with the add card loading, and a period check
stub that fires a GET every few seconds, on a focus, and on a visibility change. The stub's address
sits off the API path, so the mock server's API call log still lists the extension's requests only.
The older script names keep the bare panel. The replica keeps the panel element while the panel
stays mounted and can count a request when its response ends; ADR-0078 records why.

**Labels.** `scripts/host-labels.mjs` was run again on `app.a1e43722.js`. It prints the labels of
`app.020e81ed.js` and one more pair, Try again and ลองอีกครั้ง, the retry button of the registration
periods section. The observer reads neither, and the fill denylist holds both (ADR-0078).

## Amendment, 2026-11-26: the staff only redeploy app.ba450963

The host deployed `app.ba450963.js` on 2026-11-26 at 03:21 GMT beside the same
`chunk-vendors.7ab4925e.js`, and the helper turned Add for me off on it as designed. Compared with
`app.a1e43722.js` with the minified names normalised, the only changes are on staff pages: a staff
tool for acting as another account was renamed and its page gained a student lookup, and a staff
report gained a department filter. The `PreRegistration` route with its header, periods and period
check, the panel, the add subject card, the stepper, the complete, consent, and flow chart steps,
every reference to a registration write endpoint, and the output of `scripts/host-labels.mjs` are
the same, so the pair joins the tested list under the exact two name gate of ruling 20A. The
replica keeps the script name `app.a1e43722.js`, since the route it renders did not change.

## Amendment, 2026-11-26: the host check

The observer's tested build gate now also accepts a build the host check of ADR-0079 verified: a
tested vendor script beside an app script whose every part reads as a recorded tested build's.
While the check runs the observer waits rather than turning off, since an off reading lasts the
document; a build the check does not verify turns it off as an untested build, as before. The
anchors, labels, and drift strikes stay as they are on every build.

## Amendment, 2026-11-26: the drawer menu redeploy app.2ef67281

The host deployed `app.2ef67281.js` on 2026-11-26 at 09:38 GMT beside the same
`chunk-vendors.7ab4925e.js`, and the host check of ADR-0079 read it as a mismatch in the setup part
only, so Add for me stayed off as designed. The review compared it with `app.a1e43722.js` part by
part with `scripts/host-fingerprint.mjs --prove`, whose probes all changed the part they are in,
and again by hand with the minified names normalised. Every part but the setup reads the same, and
so does the output of `scripts/host-labels.mjs`. The setup differs only in the navigation drawer of
the App shell: its menu data was regrouped, with the staff entries and the manual entry moved and
the tuition and report entries put under new staff headings, and the drawer's scoped style id
changed with its file. No method, handler, computed value, or write endpoint of the drawer changed,
and the drawer is no part of the pre registration page. The pair joins the tested list under the
exact two name gate of ruling 20A, and its fingerprint joins the recorded table. The replica keeps
the script name `app.a1e43722.js`, since the route it renders did not change.
