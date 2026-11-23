# 78. Student initiated fill on the pre registration page

Status: Accepted
Date: 2026-11-23

Builds on ADR-0076, the registration helper companion, and ADR-0077, the read only observer on
the pre registration page, which this decision needs because every fill step is verified by
reading the page. Reviewed against rule 5, zero trust of external data, and rule 6 as the owner
amended it on 2026-11-23.

## Context

On the host's pre registration page a student types each subject id, picks a section from a
dropdown that shows the time of a section only after it is picked, picks the practice section of
a pair, and presses the local เพิ่ม (Add) button, once per subject, while the registrar is under
its heaviest load. KCP already knows which section of each subject fits the plan.

The owner ruled on 2026-11-23 at 08:47, translated: "Filling in the subject and the section
automatically is acceptable, but there must first be a student action, such as pressing a
button, to prevent the system from misfiring. We will absolutely never register on the student's
behalf, because it cannot be cancelled."

The owner then answered the open questions: stop at the first problem (3A); for an over
subscribed section, stop and ask with a button to continue (4A); after the grade not announced
dialog appears, show the prerequisite in KCP's own UI first, then press that dialog's single
acknowledgement button, then continue (5B); for a section code listed under more than one
curriculum, stop and let the student pick, preferring the row of the student's own curriculum
where it can be determined (6A); no actuator in the page's own JavaScript world, and a read probe
there only with its own ADR (7B); KCP never presses the trash icon (8A); fill on by default with a
switch for the student, gated to the tested host builds `app.454d9e95.js` with
`chunk-vendors.7ab4925e.js` (9A, 20A); the same controls on the phone (10A, 23A); show the host
credit range (12A); no remote kill switch (14A); and a read only count line beside the host
confirm dialog while the list differs from the plan (22A).

Host facts that shape the design, from KCP's reading of the tested build: the add card's loading
state is CSS only, so a dispatched event is not stopped by it; the shared card body holds both
เพิ่ม and the deep orange ดำเนินการต่อ (Continue); ดำเนินการต่อ only opens the confirm dialog,
whose ยืนยัน (Confirm) sends the one write; a green button elsewhere on the host can commit; the
host never checks the lecture of a free pair for a clash; Vuetify renders the first 20 options of
a select until it is scrolled; and the page never shows a teach table id.

## Decision

### What is forbidden forever

Level 5 is forbidden forever: KCP never presses ดำเนินการต่อ, never opens, answers, or closes the
host confirm dialog, never presses any confirm control, and never calls any registration write
endpoint (`regis-pre-regis`, `regis`, `regis-add`, `regis-change`, `regis-withdraw`,
`regis-maintain-and-drop`, `cancel-queue`), on any route, in any build, including debug builds and
live checks. Registration cannot be undone. No later ADR can supersede this paragraph; only a new
owner ruling, recorded here verbatim, can.

### What KCP may do

After a trusted press of a KCP fill control, KCP may act on these host controls only, through
the host's own handlers, from the isolated world: the subject id field, the section select and the
practice select with their options, the local เพิ่ม button, and the single รับทราบ
(Acknowledged) button of the grade not announced dialog. It never acts on any other host element,
never sets host component state, and never calls host methods.

### Guards, which landed before any code that dispatches an event

1. **Allowlist** (`features/regis/fill/hostControls.ts`). The only module that returns a host
   element for action, as one of five branded handle types. Each is found by structure from the
   anchored add row and its own label, and returns nothing unless every check passes: no
   ancestor is a dialog, a form, deep orange or warning (the acknowledgement button excepted,
   which must be the only button of an open dialog whose title is the grade not announced title
   while no confirm dialog is open); เพิ่ม must be the first button of the block after the table,
   carry the green class, and be followed by the deep orange button; an option must sit in the
   listbox the add row's own activator names.
2. **One actuator** (`features/regis/fill/hostActuator.ts`). The only module in `src` that may
   dispatch an event, call `click`, or write a value on a host element. Immediately before each
   event, in the same task, it checks that the card is not loading, that focus is not inside the
   add card, that no host dialog is open (except the grade dialog for its own button), and that
   the target's own text is not on the denylist. A hit throws, ends the run, and latches fill off
   for this host build.
3. **Denylist** (`features/regis/fill/denylist.ts`). Every clickable label of the tested host
   build in both languages, extracted from the host dictionaries by `scripts/host-labels.mjs`,
   plus the commit words the design names, matched by exact equality on the target's own text.
   เพิ่ม and รับทราบ are left out because each is checked positively by its own handle.
4. **A student press** (`features/regis/fill/studentPress.ts`). A run starts only from a
   `StudentPress`, issued once by a KCP fill button's click handler from a trusted click that the
   browser marks as user activation, single click, within a second, on a control shown for at
   least 500 ms. Each press is consumed by the run it starts. Lint forbids importing the issuer
   anywhere but the fill controls.
5. **Lint confinement.** The existing ban on dispatch, click, submit, focus, value writes, and
   event construction in `features/regis`, `lib/regis` and the content entry keeps applying
   everywhere except the actuator; the actuator may still not build a keyboard event.
6. **Write name scan.** The test from ADR-0077 that fails on any registration write name in the
   sources, the fixtures, the replica, and the built bundles.
7. **Tested build gate and refusal latch** (`lib/regis/hostBuild.ts`). Fill runs only on the
   tested host build. An actuator refusal stores the build's script names in `storage.local`,
   which are public, and fill stays off for that build until an extension update ships a newer
   allowlist.
8. **Request tripwire** (`features/regis/fill/tripwire.ts`). A `PerformanceObserver` counts new
   resource entries the page starts through `XMLHttpRequest` without reading their names, which
   carry the student id. At most one is expected after the subject id is entered, the host's own
   eligibility read, and none after any other step; any other count stops the run. It does not
   latch, because the host's token refresh can add an entry.

### The mechanism

Isolated world DOM events that do what the student's hands would do: write the field value and
dispatch one bubbling `input` event, click the select's activator, click the option whose code
is the planned code, click เพิ่ม. No keyboard event and no focus change are ever made. One subject
at a time, at least 250 ms between events, each step checked, acted on once, waited for, and
verified from a fresh reading of the page; a wait that reaches its ceiling is a stop, never a
retry. Each run is bound to the route at press time and stops on any change of it.

Identity proof without a teach table id: the kit, read from the public data at a calm time, must
show the planned code once for its subject and kind; exactly one rendered option must carry the
planned code; a curriculum suffix on it must be one the kit explains by a code shared across
lecture and practice. Otherwise KCP stops with the duplicate code reason and the student picks on
the page.

Before เพิ่ม KCP checks the row the host coloured as fitting, the seats (an over subscribed section
stops with a "continue with this section" button, 4A), and its own placement engine for the
planned group against the subjects on the page's list, because the host skips the lecture of a
free pair. A list row KCP cannot resolve to a kit section is a stop rather than a guess.

When the grade not announced dialog appears, KCP records the prerequisite ids in the dock, shows
the conditional state with those ids, waits so the student can read it, presses รับทราบ, and
continues with the sections (5B).

### The student's controls

กรอกวิชานี้ (Fill this subject) on each row and กรอกทุกวิชา (Fill all subjects) in the header,
หยุดกรอก (Stop filling) during a run, กรอกต่อ (Continue filling) after a stop, and a switch
กรอกในหน้าลงทะเบียนให้ (Fill the registration page for me), on by default. Every stop names its
reason in one sentence with the next step, in Thai and English. During a run the header warns not
to press ดำเนินการต่อ until every subject is in; after it the final review hands off to the student,
and the count line beside the confirm dialog stays. One status line announces the step, the stop,
or the end of a run, and joins the live region inventory of ADR-0048.

## Alternatives

- **A script in the page's JavaScript world that sets component state or calls host methods.**
  Rejected as an actuator permanently: it shares a realm with the session token and holds the
  same object that owns the submit method.
- **No fill, the copy button only.** Kept as the fallback for every stop, but it leaves the
  slowest part of the morning to the student.
- **Skip a subject and go on after a problem.** Rejected by the owner (3A); skipping is a student
  decision.
- **Leave the grade dialog to the student.** Replaced by 5B: KCP presses its one acknowledgement
  button only after it has shown the condition in its own UI.

## Consequences

- Fill is coupled to the Vuetify 2 markup and the tested host build; a host redeploy turns it off
  until a release ships with the new names after a calm look at the new bundle.
- The behaviour replica and its counters are written from KCP's own reading of the host, so they
  cannot catch a change in what a button means; the tested build gate is what covers that.
- The identity proof is by uniqueness, not by id; the final review asks the student to check the
  curriculum by eye where the kit knows of variants.
- Not yet built: comparing the page's time text with the kit, a watcher that tells a mutation KCP
  caused from one it did not between steps (each step's fresh reading covers the same fields),
  and the stuck page message after the host's own 120 second timeout.
- `docs/PRIVACY.md` and the store listing say that on the student's press KCP enters the planned
  subjects and sections into the page's own form for review, and never submits or confirms.

## Revisit triggers

The host leaves Vue 2, the host starts rejecting untrusted events, duplicate codes prove common,
the regular registration page gets its live look, or the university states a rule on form filling
tools.
