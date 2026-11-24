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
observer off. Whenever it is not healthy, the checklist shows the student's marks only and the
dock says why in one line. The surrogate check, in `features/regis/host/surrogate.ts`, is the one
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
  leaves the manual marks until a release carries the new names.
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

With the helper card of the ADR-0076 amendment, the observer's reading is the only thing that sets
a subject's status; there is no manual mark to override it. Each subject reads as not added, added
as planned, another section, conditional, refused, or submitted from the page, and full or clash
from a fill stop. While the observer is degraded or off, each subject keeps the last status the
page showed in this visit, drawn as stale, and the card shows a page unreadable bar with Check
again, which starts the reading over; the health machine still keeps an off observer off for the
document. Nothing read is stored, and the count line beside the host's confirm dialog stays.
