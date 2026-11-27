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
   carry the green class, and be followed by the deep orange button labelled ดำเนินการต่อ
   (Continue), read as a label and never pressed; an option must sit in the
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
to press ดำเนินการต่อ until every subject is in. The final line that hands off to the student once
every planned subject is in was not built with the card; it landed in the helper card amendment of
2026-11-27 of ADR-0076. The count line beside the confirm dialog stays. One status line announces the step, the stop,
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
- The identity proof is by uniqueness, not by id; the helper card's several curricula pill asks the
  student to check the curriculum by eye where the kit knows of variants.
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
  the student hides the helper on this page, collapses the card to the launcher (by Escape; a press
  of the launcher and, on a phone, a tap on the page collapse it only while no run is active, see
  the amendments of 2026-11-26), or opens the planner over the page, and a
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

## Amendment, 2026-11-26: what stops a run on a touch screen

The owner tried Add all for me on Firefox for Android and found that it stopped when a finger
touched the screen by accident. The card collapsed on any pointerdown outside KCP on a phone, the
start of a scroll on the host page included, and a collapsed card is one of the states above in
which a run ends. A stray touch is no reason to stop, so the rules change as follows.

- **A run keeps the card open.** While a run is active a press outside KCP never collapses the card,
  so the step progress and Stop stay on screen. Stop and Escape inside the card still stop the run
  at once, as before; they are the deliberate ways to stop. (A press of the launcher stopped it too
  until the second amendment of this date.) Removing the collapsed state from the stop conditions instead was rejected: a collapsed
  card shows no Stop, and a run the student cannot see must not go on.
- **Outside press means a tap.** Everywhere in the helper, the card on a phone and the section and
  more menus, an outside press counts only when the pointer comes up within 10 px of where it went
  down, with no second pointer down, no scroll in between, and no pointercancel, which touch
  browsers send when they take a gesture over for scrolling or zoom. Scrolling or pinching the host
  page never collapses the card or closes a menu.
- **Every other touch path was checked.** The address bar hiding during a scroll changes the visual
  viewport, which only moves the helper's fixed layers through their custom properties; a resize
  does the same, and the phone breakpoint reads the width, which a scroll does not change. Nothing
  in the helper or the run listens for focus, blur, or visibility, but the host does, and that path
  is not closed: see the second amendment of this date. The hidden flag changes only from
  Hide on this page in the more menu, and the planner opens only from a KCP control, never from a
  touch on the page; the entry toast, which offered one, no longer shows on the helper pages
  (ADR-0076). A real page change still stops a run: a hash change, the panel going away or a new
  panel, the tripwire, a host dialog the engine does not expect, and the engine's own state checks
  when the student presses a host control mid run.
- **Prepare and fill exclude each other.** The helper may now prepare on the pre registration page
  (ADR-0076). A run cannot start while prepare reads, Add for me says why (รอให้เตรียมข้อมูลเสร็จก่อน),
  and prepare cannot start while a run is active. Prepare's reads go through the background gateway
  to the public API, not through the page, so the page's performance timeline holds no entry for
  them and the tripwire, which counts the page's own XMLHttpRequest resource entries, cannot count
  them.
- **Tests.** Unit tests cover the tap rule (a move past 10 px, a scroll, a pointercancel, and a
  second finger are no tap) and the card staying open on a page tap while a run is active. A debug
  spec at 412 by 915 with touch emulation taps the page, scrolls it, and taps its header during Add
  all for me on the a1e43722 route; the run adds every subject with nothing forbidden pressed and
  nothing written, and Stop still stops at once. The spec fails with the old collapse.

## Amendment, 2026-11-26: the stray touches a review found left

A review of the amendment above with touch emulation at 412 by 915 found that a tap, a scroll, a
pinch, a long press, a resize, and a rotation on the host page no longer stop a run, and that two
stray touches and one gap remained. Every guard above is unchanged: a run starts only from a
trusted student press, acts only on the allowlist through the one actuator, never presses
ดำเนินการต่อ or any confirm control, and never causes a host write.

- **A press of the launcher no longer stops a run.** The launcher sits at the bottom right, where a
  thumb rests on a phone, and on a tall screen it sits 64 px higher on the helper pages than
  elsewhere, further into that zone (ADR-0076). While a run is active a press of it keeps the card
  open and moves focus to Stop, so the run goes on with Stop in view. Stop and Escape inside the
  card stay the deliberate ways to stop. Keeping the collapse and letting the run go on behind the
  launcher was rejected, since a run with no Stop on screen must not go on, which is why a collapse
  ends a run.
- **The list no longer hides Stop during a run.** The count in the card's header opens the list of
  every subject, which shows neither the step progress nor Stop, so a stray tap on the count left a
  run going with no Stop on screen. While a run is active the card keeps its card view: the count is
  held, its name says the list opens once Add for me ends, and a press of it changes nothing. Add
  for me on a list row returns to the card with that subject in focus, and Stop takes the focus the
  pressed control dropped, which also holds for the card's own Add for me.
- **The period check on a window focus still stops a run.** The amendment above says nothing in the
  helper or the run listens for focus or visibility, which is true, but the host does: app.a1e43722
  checks its registration period on a window focus, on a visibility change, and every 60 s, and the
  tripwire counts that request and stops the run as `pageRequest`. Firefox for Android takes focus
  off the page when a finger touches its toolbar or address bar, so the next touch on the page
  focuses the window again and the check lands in the run. This is the likeliest stop left, from a
  touch or from the 60 s timer with no touch at all. The stop is fail closed and costs the student
  one press of Add for me, which goes on from the first subject not yet added. Telling the request
  apart by its address stays rejected, since entry names carry the student id. One name blind
  option is for KCP to listen for its own window focus and visibility change events and to accept
  exactly one request that starts within a short window after such an event, and only while the
  page reading is unchanged (no new toast or dialog, the same list, the same panel). It loosens
  guard 8, which the amendment of 2026-11-25 kept exact after an action, so it awaits the owner's
  decision and is not built.
- **Tests.** A unit test presses the launcher during a run and finds the card open and Stop
  focused, and the same press with no run collapses the card; another finds the count held and the
  list closed during a run, and the list back once the run ends. A debug spec presses the launcher
  while the host reads a subject and the run fills it, and the touch spec at 412 by 915 also taps
  the count and the launcher during Add all for me, which still adds every subject with nothing
  forbidden pressed and nothing written.

## Amendment, 2026-11-26: the host's period check no longer stops a run

The owner ruled on 2026-11-26, answering the question the amendment above left open, that Add for
me must not stop because of the host's own period check. Every guard above is unchanged: a run
starts only from a trusted student press, acts only on the allowlist through the one actuator, one
subject at a time with the host's answer verified at each step, ends at the first stop, never
presses ดำเนินการต่อ or any confirm control, and never causes a host write. KCP never sends the
period check; it only stops counting it.

- **The tripwire leaves out one request by its exact name.** For each XMLHttpRequest resource
  entry, the observer callback parses the entry name as a URL and leaves the entry out of the
  count only when its origin and path are the host API, `https://regis.reg.kmitl.ac.th/api/`, and it
  carries exactly one `function` query parameter equal to `check-registration-datetime`. The
  comparison is by exact equality: another case, a prefix, a suffix such as
  `check-registration-datetime-x`, a second `function` parameter, an empty one, another path, a path
  below the API, another origin, plain http, and a name that is no URL are all counted. Every entry
  is counted before any name is looked at, so a name that cannot be read leaves the count high and
  the run stops.
- **Why the exact name match is safe.** The name is compared in memory inside the callback and then
  dropped; the tripwire keeps a count and nothing else, so nothing of a name is stored, logged,
  shown, or sent. Some names carry the student id, and comparing them against one fixed constant
  extracts and retains no part of them, so rule 6 holds. The request is the host's own read only
  GET: in every studied build (app.454d9e95, app.020e81ed, app.a1e43722, and app.ba450963) the
  function appears once, in `checkRegistrationDateTime`, sent through the API client's `get`, which
  puts its parameters in the query, and they are the level, year, and semester. Resource timing does
  not expose the method, and none is needed: the client's `create` and `post` send the function in
  the JSON body, so a registration write such as regis-pre-regis reaches `/api/` with no function in
  its address and is counted. (Corrected by the review amendment below: one write goes through the
  client's `delete` with its function in the query, and is counted all the same.) Any other request still stops the run in every window: after the
  subject id is entered only the eligibility read may follow, and after every other step nothing.
- **The run does not wait for the check or read its answer.** A check whose answer closes the
  period unmounts the panel, and the run stops at once as a page that changed, as the amendment of
  2026-11-25 records. The quiet wait before KCP first acts stays, for any other request the press
  that focuses the window may start, such as a token refresh.
- **What this supersedes.** "The tripwire stays count based and name blind" and "Telling the request
  apart by its address stays rejected" above, and the stop of a run on a period check. The name
  blind option of listening for focus and visibility events is not built: it would loosen every
  window around a focus and still miss the 60 s timer. Allowing one more request by count stays
  rejected, since it would let an unknown request pass at that step, and so does a prefix or
  substring match, which a near miss would pass.
- **Tests.** Unit tests feed the tripwire resource entries and find the period check left out mid
  run while another function, every near miss listed above, and an unreadable name together with the
  rest of its batch are counted. The engine, fed through the real tripwire, goes on through a period
  check while the host reads the entered subject, while a section is chosen, as Add is pressed, and
  at every step of Add all, and still stops on another request at each of those steps. The
  replica's period check now goes to the host's own address, `/api/` with the real function name,
  so the debug specs exercise the exact match: a run goes on through checks from the timer, a focus,
  and a visibility change, Add all adds every subject through one, a GET whose function only starts
  with the period check's name and another host function each still stop a run that the next press
  finishes, and the touch spec at 412 by 915 runs with the check every second. With the function
  name changed in the tripwire, the first of these specs fails.

## Amendment, 2026-11-26: Add for me at the host's pace

The owner asked on 2026-11-26 for Add for me to be faster, since a run felt like a person pressing
one button at a time. Every guard above is unchanged: a run starts only from a trusted student
press, acts only on the allowlist through the one actuator, goes one subject at a time and never
starts a subject before the one before it is on the page's list, never acts before the host's
answer to the step before is verified from a fresh reading, ends at the first stop, reads Stop
within 100 ms, never presses ดำเนินการต่อ or any confirm control, and never causes a host write.
Only how long the run waits changed.

- **What was measured.** A new debug spec (`regis-speed.debug.spec.ts`) runs Add all for me on the
  replica of the app.a1e43722 route, whose eligibility read now answers only when its request ends,
  250 ms after it starts, as the host renders its answer in the read's own resolution. It records
  in the page each event KCP dispatches and each answer of the host. Before this amendment, eight
  subjects took 12.4 s. The first subject took 2.9 s, 1.8 s of it before the id was typed (the
  1500 ms quiet wait and the 250 ms pace); every later subject took 1.35 s: typing the id 255 ms,
  the host's read 270 ms, opening the menu 315 ms, choosing the section 258 ms, pressing Add
  260 ms, and the list row 1 ms. The host's own answer was a fifth of each subject; the rest was
  the pace before each event and the 100 ms poll after it. Three subjects with a grade dialog on
  the second, with the period check every second, took 7.3 s, 1.8 s of it at the dialog.
- **After.** Eight subjects take 2.4 s to 2.6 s: each subject takes 280 ms to 335 ms, of which the
  host's read is 260 ms to 280 ms; typing the id, opening the menu, choosing, and pressing Add take
  1 ms to 24 ms each. The grade dialog run takes 1.7 s, 770 ms of it at the dialog. The time of a
  subject is now the host's answer.
- **No pace between events.** The host needs none, by its render functions in app.a1e43722: the
  subject field is a `v-text-field` whose `input` listener and `v-model` run on the one input event
  and start the search; a section `v-select` opens on the activator's click and takes an option on
  the option's click, then runs its async check of time and exam clashes, which sends no request,
  and colours the row; and Add pushes to the list on its click. Each renders in a Vue microtask.
  Since the run verifies each answer before it acts again, a pace only made the student wait. Each
  action still begins on a task of its own, after a Stop check, so a Stop press in between is read
  first.
- **Waits end on the host's change** (`features/regis/fill/pageWatch.ts`). A mutation observer on
  the whole document ends a wait at the first task after the page changes, and the run reads the
  page again from the start; the 100 ms poll stays as the fallback that reads Stop and the
  ceilings when the page is still. The reading runs one task after the change, never inside the
  mutation callback, because the host chains microtasks after its render, such as the section
  check that colours the add row and the move of a dialog to the app root on the next tick, and all
  of them end before the next task. The task is a message on a channel of KCP's own, which a
  browser does not throttle in a background tab the way it throttles timers. Watching only the
  roots the read only observer watches was not taken: the menus and dialogs attach under the app
  root and the toasts under the body, and a countdown tick on the whole document costs only a
  second reading. Resolving inside the callback was rejected, since it can read half an answer.
- **The tripwire takes its buffered entries when the count is read.** A probe in Chromium and
  Firefox found that at the end of a request the resource entry is already in the observer's
  buffer while the observer's callback has not yet run. The run now reads the count in the tasks
  that follow the host's answer, and the browser does not promise which task runs first, so each
  reading of the count first takes the buffered entries itself (`takeRecords`). The eligibility read
  then always lands in the window of the step that caused it, and every window stays exact. On the
  replica the run also passed without it, so this removes an ordering the run would otherwise rely
  on rather than fixing a measured stop. A batch with an entry that cannot be read is now counted
  whole without the callback throwing.
- **The quiet wait is paid only on a busy page.** Before KCP first acts, the run waits for the
  request count to stay the same for 1500 ms only when the page's resource timeline shows a request
  the tripwire would count that ended in the last 1500 ms, such as the reads of a panel that just
  mounted again; the period check is left out as before, so a press that focuses the window no
  longer waits. A full timeline, which takes no more entries after 250, and an entry that cannot be
  read both read as busy. The tripwire keeps the time the last counted request ended, a number,
  and nothing of any name. What this gives up: a request still running at the press is not in the
  timeline, so one that ends after KCP's first action stops the run as a request of the page's own,
  and the next press goes on. In the studied bundles the only request the page starts on a focus is
  the period check, and the token refresh runs on its own timer, so such a request is rare, and a
  run that takes seconds rather than tens of seconds meets fewer requests of the page's own mid
  run as well.
- **The grade dialog waits only for the shown condition.** The fixed 1500 ms wait is gone. The run
  acknowledges the dialog the moment KCP's card has shown the subject's condition for 750 ms, the
  same least time as before, which was half the old wait; it reads the card's record and its clock,
  since the card renders in KCP's own root, which the page watch does not see. A card that does not
  show it within the 3000 ms settle ceiling stops the run as an open dialog, as before. The
  condition is still on screen in the task of the check, and only one task now separates the check
  from the click, where the pace used to put 250 ms. The helper keeps the condition it read after
  the dialog closes. The wait for the dialog to close is observed as before.
- **What this supersedes.** "At least 250 ms between events" in the mechanism section, the wait "so
  the student can read it" of 1500 ms, the record that "has stood for at least half the wait", and
  the quiet wait the review fixes amendment of 2026-11-25 paid on every run.
- **Rejected.** A shorter pace, such as 50 ms, adds four to six waits a subject that check nothing.
  Setting the host's component state or calling its methods to skip the menus stays forbidden by
  rule 6. Two subjects at once stays forbidden, since the page has one add row and the first stop
  must end the run. Dropping the quiet wait altogether would lose the busy page it was made for.
- **Tests.** Unit tests on fake timers run the shipped timing on the replica with a 250 ms read:
  eight subjects take the time of the eight reads plus less than 40 ms, the first id is typed at
  once, the quiet wait is paid once and only after a request just before the press, a request
  that ended before that window is not waited for, the grade dialog is acknowledged between 750 ms
  and 760 ms after the condition shows, and a Stop press during the read ends the run within one
  poll. The page watch is tested for its wake at the next task after the host's chained microtasks,
  its fallback time, one task for many waits, and its stop. The tripwire is tested for taking the
  buffered entries once, the busy and quiet readings of its timeline, and an unreadable batch. The
  engine test of an option list that changes after it was read now makes the change in the task
  between the reading and the click. The speed spec asserts the order of every event of every
  subject, that no read answers early, that eight subjects finish within 2 s over their reads, that
  the grade dialog waits from 750 ms to 1350 ms, and that nothing forbidden was pressed, nothing was
  written, and KCP sent no request.

## Amendment, 2026-11-26: the host check

Fill no longer needs an exact tested pair of script names. ADR-0079 adds a host check: when the
vendor script is a tested one, the worker reads the page's app script once by its exact name,
fingerprints the parts fill depends on, and the build counts as tested when every part equals a
recorded tested build's. Any other outcome keeps fill off with the untested build sentence, as the
owner asked (1A). The exact list stays the fast path, and every guard here, the tripwire, the per
step verification, and the refusal latch stay as they are. This supersedes "gated to the tested
host builds" in the context and the first consequence's "a host redeploy turns it off until a
release ships with the new names" for a redeploy whose parts read the same.

## Amendment, 2026-11-26: review fixes to the tripwire and the build gate

A review of the host check found the tripwire too narrow for builds nobody reviewed, since it is
now the last backstop there.

- **Every host API call counts.** The tripwire counted only XMLHttpRequest entries, so a request the
  page started through fetch, a beacon, or an image went unseen. It now counts every XMLHttpRequest,
  as before, and every entry addressed to the host API however it was started: any address on
  `https://api.reg.kmitl.ac.th`, and any path of `https://regis.reg.kmitl.ac.th` that starts with
  its API folder in any letter case. An address it cannot read counts. Counting every resource entry
  was rejected, because during a run the page loads its own scripts, styles, and images and sends
  its analytics to another site, and none of those can be a host write. KCP itself starts no request
  in the page.
- **The period check exemption reads every key.** An address with one `function` equal to the
  period check's still passed with another key beside it, such as `function[]`, its encoded form,
  or `FUNCTION`, which a PHP or qs server may read as another function. The exemption now also
  requires every query key to be one the period check sends, `function`, `level_id`, `year`,
  `semester`, and `sub_level_id`, each once. Encoded spellings of the exact address stay exempt,
  since they are the same request.
- **The write address reasoning.** The period check amendment said a write carries its function
  only in the body. In all four studied bundles one rule 6 write, the queue cancel, goes through the
  client's `delete` with its function in the query. Safety held, since that address is not the
  exact exempt one and is counted, and the reasoning in the code and here now says so.
- **A checking gate.** While the host check reads a new build, the gate read as untested, so a run
  met in that window would have stopped with the sentence that KCP had not been tested with the
  page, although the build may be verified seconds later. The gate now has a checking state: Add
  for me says that KCP is checking this page version, and a run that meets it stops with a sentence
  that asks the student to try again in a moment. Holding the press until the answer was rejected,
  since a run begins only on the press it names.

Tests cover each initiator to the host API, the analytics, page image, and page script left out, an
XMLHttpRequest to another site still counted, the extra key cases, the encoded exact address, the
checking gate, and the checking block on the card.

## Amendment, 2026-11-27: a stop of its own for the confirm dialog

The host's confirm dialog opens only on the student's own press of ดำเนินการต่อ. A run met it as the
generic open window stop, `dialogOpen`, and only when a step began through `pageBlock`, while the
engine's own reading reacted mid run only to the grade not announced dialog, so a run waiting for
the host's answer read on under the confirm dialog until its next step.

- **Its own reason.** `confirmOpen` joins `STOP_REASONS` in `lib/regis/fillPlan.ts`, and `pageBlock`
  maps `confirmSubmit` to it ahead of the generic reason, which stays for any other dialog.
- **Every reading.** The engine's one reading function, which every step and every wait goes
  through, ends the run with `confirmOpen` the moment a reading shows the confirm dialog, so the run
  stops at the step the dialog appears in and never acts or waits under it.
- **What the sentence says.** It says what KCP did, not what the host holds: KCP stopped adding and
  presses nothing in that window, and the student can go back with the window's own back button. It
  makes no claim about what the page sent. It is read in the helper's live region, as other stops
  that are not failures of the run are.
- **Focus.** The stop collapses nothing and calls no focus, so the focus the dialog holds stays
  where it is.
- **Tests.** Unit tests cover the mapping, the dialog opening at the wait, choose, and add steps of a
  run of two subjects with no Add, confirm, or back press and no second subject entered, and a run
  pressed while the dialog is open starting nothing. A spec on the pre registration replica, which
  renders the confirm dialog, has the student press the host's Continue while the host reads a
  subject, and checks the stop, its sentence, that `document.activeElement` is the same across the
  stop and the host's later answer, and that KCP sent no event outside the subject field.
