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
   listbox the add row's own activator names, as its direct child. Because a dispatched click
   runs the activation behaviour of the nearest element on its path, a target is also refused
   when it is a link, a label, a button that is not of type button or that a form owns, or a
   field a form owns, and when any ancestor is a link, a label, a button, a button or link role,
   or carries a click attribute. A label for Continue around an option, or an Add left at the
   default submit type naming a form elsewhere, would otherwise turn an allowed press into a
   press of Continue or a form submit.
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
   everywhere except the actuator; the actuator may still not build a keyboard event. Each
   action is matched as any reference to its member, computed or destructured, so a call through
   `.call`, `Reflect.apply`, or a string key is caught, each event as a bare or a namespaced
   constructor, and the property writes include `disabled` and `hidden` and writes through
   `Object.assign` or `Reflect.set`.
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
the page. The proof runs again on the list as it stands in the task of the click, and a list that
changed since it was read is a stop.

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
กรอกในหน้าลงทะเบียนให้ (Fill the registration page for me), on by default; turning it off during a
run ends the run at the next step like หยุดกรอก. Every stop names its
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

## Amendment, 2026-11-24: Add for me on the helper card

The student's controls move to the helper card of the ADR-0076 amendment; every guard above is
unchanged, and each control still issues a press only from the student's own trusted click.

- **Add for me** (เพิ่มให้) is the right hand button of the action row, beside Copy ID, for the
  subject in focus while the page does not list it, and the plus button on each list row. A press
  starts a run for that one subject with the section the student chose, or the planned one. A
  section the page shows over subscribed offers Add for me again to fill it anyway.
- While a run is active the action row becomes the step progress, enter the id, pick the section,
  press add, with **Stop** (หยุด) in place of Add for me, so one bounce cannot stop and resume a
  run. Collapsing the card ends a run, as the amendment below records.
- When Add for me cannot run it stays focusable with `aria-disabled` and its reason, first reason
  first: not on this page, switched off, nothing prepared, page unreadable, another term, outside
  the choose subjects step, or another run active. The reason shows as a tooltip, or as a line
  under the row on touch.
- The switch is Use Add for me in the more menu, on by default; turning it off during a run still
  ends the run at the next step. Fill all subjects is dropped; each subject's Add for me replaces
  it. The stop sentence for a run shows under the action row of its subject.
- Add for me is keyed by the helper's plan, its subject, the sections it fills, and whether it
  keeps an over subscribed section, so a change of what it adds, such as the focus moving on after
  the page shows a subject settled or the helper's plan changing under it, is a new button whose
  half second starts then.
- The condition before the grade not announced dialog is shown on the card's focus section, which
  appears only for the subject in focus in the card view. The focus section records which
  subject's condition it shows and since when, and the run acknowledges the dialog only when that
  record names the subject and has stood for at least half the wait. A collapsed card, the list,
  another subject in focus, or the planner over the card stops the run as for an open dialog, and
  the student reads and closes the dialog on the page.

## Amendment, 2026-11-25: Add all for me, and the helper leaving the page

The owner ruled that features come before package size, so the parts the card build cut return.
Every guard above is unchanged: a run still starts only from a trusted student press on a fill
control, the actuator acts only on its allowlist, a press counts only once its control has shown
for half a second and is keyed by what it names, and the grade dialog is acknowledged only while
the card shows the condition. KCP never presses ดำเนินการต่อ or any confirm control, and never
causes a host write.

- **Add all for me** (เพิ่มให้ทุกวิชา) returns as an item of the more menu on the pre
  registration page. One press starts one run that names every subject whose status is not added,
  in plan order. A subject the page refused, or that a run stopped on as full or as a clash, is left
  for the student's own choice of another section, so a second press never stops on it again. The
  run still goes one subject at a time, waits for the page between steps, and ends at the first
  stop (3A). The item is a press control in the fill controls module, keyed by the helper's plan
  and the sections it fills for each subject it names. The press returns the card to its card view
  with no subject pinned, so the focus follows the subject being added and its condition can show
  before the dialog is acknowledged. While such a run adds, the card never moves the focus on by
  itself when a subject settles, since the next subject that needs action can be one the run does
  not name, such as a refused subject between two it adds; only a chip the student presses pins
  the focus again, and then a grade dialog stops the run as above. When it cannot run the item
  stays, with its reason under its label.
- **A press on a disabled Add for me**, on the card, a list row, or the menu, shows its reason in
  the error toast and starts nothing, because a touch screen shows no tooltip.
- **Leaving the page ends a run.** A run ends at its next step boundary exactly as Stop does when
  the student hides the helper on this page, collapses the card to the launcher (by Escape, a press
  of the launcher, or on a phone a press on the page), or opens the planner over the page, and a
  press cannot start one in any of these states, since in each the step progress and its Stop are
  off screen. Keeping a
  Stop on the collapsed launcher was considered and not taken: collapse is the natural gesture for
  making the helper go away, and a run the student cannot see should not go on.
- **A failed run**, one whose step was not confirmed in time, whose page changed under it, or whose
  page could not be read, shows Could not add (เพิ่มให้ไม่สำเร็จ) in the error toast, whose live
  region reads it, in place of its stop sentence in the helper's live region, so the failure is
  read once. The stop sentence still shows under the action row.

The package budget moves to 420 KiB with this amendment.

## Amendment, 2026-11-25: the polling host, and a request of the page's own

The host build `app.a1e43722.js` (ADR-0077 amendment of this date) checks the registration period
with a GET every 60 s, on a window focus, on a visibility change, and at a countdown boundary, and
the answer can unmount the panel or mount it again with no navigation. Every guard above is
unchanged: a run starts only from a trusted student press, acts only on the allowlist through the
one actuator, never presses ดำเนินการต่อ or any confirm control, and never causes a host write.

- **The tripwire stays count based and name blind.** A period check that lands in a run moves the
  request count, so the run stops at the same three checks as before. Telling the check apart by
  its address was considered and not taken, because it would mean reading resource entry names,
  which carry the student id. Allowing one more request by count was not taken either, because it
  would also let an unknown request pass at that step. The stop is the correct fail closed answer.
- **The stop has its own reason**, a request of the page's own (`pageRequest`), in place of the
  page that cannot be read, whose sentence sent the student to enter the list by hand. Its sentence
  says the page sent a request of its own, so KCP stopped to be safe, and to press Add for me to go
  on. It is read in the helper's live region and shows no error toast, since the run did not fail.
  The subject stays to add. Nothing retries on its own: the next run begins only from a new student
  press, which picks the subject up where the page left it, from the offered sections in the field
  or from the list when the add had landed, so a check costs one press and no second eligibility
  read. Add all for me names only the subjects the page does not list, so its next press goes on
  from the first subject not yet added. With a check every 60 s and a few seconds a subject, a
  focus on returning to the window during a run is the likeliest way a run meets one; the press
  that focuses the window is waited out, as the amendment below records.
- **The sentence names a cause it cannot check.** The tripwire reads no names, so the same
  sentence also follows an unknown request, including one after the press of Add, which before
  this amendment sent the student to enter the list by hand. That is accepted because the panel
  of the tested build is byte identical to the builds before it and the build gate is by exact
  name, so the only request this build adds is the period check, and the run stops either way.
- **A panel that leaves ends the run at once.** A reading that finds no panel stops the run with
  the page changed reason once it has acted, or not ready before, instead of waiting out the answer
  ceiling, and the same check runs in the task of each action, so nothing is ever dispatched on a
  page without a panel.
- **A loading add card is waited for.** When the panel mounts again its add card reads the
  student's credits with the card loading; a subject that starts then waits for the card as for the
  host's answer, up to the same ceiling, and checks what it settles to, so a typed id still stops
  as a field that is not empty.
- **The dock shows that wait.** The subject is named as waiting before the wait begins, so the
  dock no longer shows the step before it, and a card that never finishes loading stops with its
  own sentence (`cardLoading`), which says the page is still loading and that KCP entered nothing,
  in place of the sentence for a host that has not answered.

## Amendment, 2026-11-25: review fixes to the polling host support

- **The press that focuses the window is waited out.** A press of Add for me from another window
  is the click that focuses the browser, and the polling build checks its period on that focus.
  The GET ends just after the run begins, so its resource entry joined the host's eligibility read
  in the first window, and every such run stopped the first subject with the field filled. Before
  KCP first acts in a run, it now waits until the request count stays the same for 1500 ms, at
  most the 3000 ms settle ceiling, and counts from there. A request that ends before KCP's first
  action cannot be one KCP caused. A request still running when the wait ends lands in a window
  after an action and stops the run as before. Allowing one more request after an action stays
  rejected.
- **The count carries across subjects.** Until KCP first acts the count starts over at each
  subject; from then on it carries from one subject to the next, so a request that ends just after
  one subject's Add is counted against the next subject's first window instead of being dropped.
  Every window after an action is exact.
- **A run keeps to the panel it began on.** The run records the panel element it starts on and
  stops, as a page that changed once it has acted or as not ready before, whenever a reading finds
  another. A Vue `v-if` mount always makes a new element, and a new panel has lost the subjects
  already added, since the host keeps the list in component data. Before, a remount that completed
  between one subject's last check and the next subject's first reading would have let the run
  fill the new panel and count the lost subject as filled. This holds without the tripwire, which
  browsers without `PerformanceObserver` lack.
- **The denylist was regenerated.** `scripts/host-labels.mjs` run on `app.a1e43722.js` prints the
  labels of `app.020e81ed.js` and one more pair, Try again and ลองอีกครั้ง, the retry button that
  the registration periods section shows when its check fails and that runs the check again. No
  resolver reaches it, since it sits outside the add card and the dialogs, and the denylist holds
  it, so guard 3 again lists every clickable label of the tested build.
- **The replica counts as the tripwire does.** It can count each eligibility read and period check
  when its response ends, as a resource entry arrives, and it keeps the panel element while the
  panel stays mounted, as Vue patches it in place. The unit tests of the first two bullets and of
  the panel identity rely on both.
