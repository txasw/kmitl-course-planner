# 76. Registration helper companion

Status: Accepted
Date: 2026-11-23

Builds on ADR-0075, quiet mode on the registration pages. Amends brief section 6.1, where the
launcher always opens the full overlay, and adds two content owned storage keys beside the plan
root. Reviewed against rule 5, least privilege and zero trust of external data, and rule 6, read
only integration with the host site.

## Context

The host's pre registration page shows one section dropdown per subject and reveals the time of a
section only after it is picked, so a student cannot compare sections there. KCP already knows the
whole picture: which section of each subject the plan holds, every other section, and which of them
fit the rest of the plan. Students asked for that picture beside the registration page on the
morning it opens.

That morning is also when the registrar can least take extra load (ADR-0075), so nothing the
helper shows may depend on a request made on the registration pages. And the student must stay the
one who enters and submits the registration, which cannot be undone.

## Decision

**The registration kit.** A prepare action in the plan menu, labelled ตัวช่วยลงทะเบียน in Thai and
Registration helper in English, reads each planned subject once by subject id through the existing
gateway, one subject at a time with a short pause and with retries turned off, so a failed read
is reported as unread rather than sent again, and only when the student presses it. It is
refused on the registration pages with a one line reason before any request is sent (except the
helper's own press on pre registration, amendment of 2026-11-26), a run that
reaches such a page stops, and the student can cancel, which aborts the read in flight. From the
results `lib/regis/kit.ts` builds a kit per plan: every section of each planned subject with its
meetings, exam windows, seats at prepare time, and printed conditions, which group is the planned
one, and how every other group fits the rest of the plan through `checkPlacement`, so a fit badge
means what it means in the planner. A by subject id read spans every curriculum, so a section code
listed more than once for one kind is flagged; when the stored id is gone, the row of the curriculum
the entry was searched under wins, then the saved curriculum profile. The kit is valid for 7 days
and is checked again against the plan, from the sections it already holds, whenever the plan
changes. The readiness card says how many subjects are ready, which have other sections that fit,
and which need a look: a full or closed planned section, conditions, a duplicate code, or a
planned section no longer listed.

**The companion dock.** On `#/pre_registration` and `#/registration` only, matched by exact path,
the launcher names the checklist and its progress (เช็กลิสต์ 2/6) and opens a dock beside the page
instead of the overlay. The dock is not modal: no focus trap, no scroll lock, no backdrop, so the
host page stays usable, and the full planner is one action away. It docks on the right, in full
from 1440 px and as a narrow bar below that the student can expand; on a phone it is a bottom
sheet whose peek bar names the next subject with a copy button, raised to half or full height on
demand, so at rest it sits below a host dialog's buttons; a press anywhere on the page lowers a
raised sheet to the peek bar, so the dialog that press opens is in view. The install welcome, a
modal, never opens on these pages. Each row shows the subject id with a copy
button, the name and credits, the planned section and its practice pair with every meeting and exam
window, the condition and duplicate code notes, the other sections with their fit, and the
student's mark: not added yet, added on the page, added another section, conditional on a
prerequisite, or skipped. The header shows the plan, its term with a prompt to compare it with the
page, the credits, and a fixed line that KCP never submits and that the student presses
ดำเนินการต่อ and confirms themselves; on pre registration it adds that pre registration can be
submitted only once, and on regular registration that the student checks the list. The one time
submit warning in the final review and the note that pre registration assigns the seats of a
full section later appear on pre registration only. A final review lists the rows that differ
from the plan first, then the conditional rows and those whose curriculum
must be checked by eye. Without a kit, or with one older than 7 days, the dock lists the plan from
its snapshots and asks the student to prepare at a calm time.

**Storage.** The kits live under `kcp:regkit` and the marks under `kcp:checklist`, content owned
keys apart from the plan root, so the plan schema version does not change. Each is a versioned list
of per plan items validated item by item through Zod, with a bad item moved aside under a
quarantine key while the rest load, and a newer schema refused and never overwritten. They keep the
12 most recent plans. Everything in them is public course data or the student's own marks.

**No host reading or acting in this release.** KCP reads nothing on the host page, writes nothing
into it, presses nothing, and sends no request from the registration pages. The page term is not
read, so the checklist never claims the page agrees; the student compares it. Permissions stay
`["storage"]`.

**Owner rulings that govern this release and the later fill.** Recorded 2026-11-23:

- Target this pre registration window (1A).
- The prepare action may read public data once per planned subject at a calm time, and the kit is
  usable for 7 days (2A).
- A backup section picked on registration day stays a checklist mark with a save to plan action;
  the plan never changes on its own (11A).
- KCP search stays available on the registration pages behind the busy notice with no retry, as
  ADR-0075 shipped (13A).
- The dock sits on the right, in full from 1440 px and as a narrow bar below (17A), and the phone
  sheet ships with the first release (23A).
- Labels: เช็กลิสต์ now, and for the later fill กรอกวิชานี้, กรอกทุกวิชา, หยุดกรอก, and กรอกต่อ (18A).
- Carry over from pre registration to regular registration is not known, so the regular page dock
  reads what the student marks and assumes nothing (19C).
- For a section code listed under two curricula, the row of the student's own curriculum, the one
  the plan entry's search named, is preferred, and the page must still show both for the student
  to check (24C with the owner's note).
- The later fill may enter the planned subject id and choose the planned section in the host's own
  controls only after a student press in KCP, per subject or for the whole plan; KCP never presses
  the host's continue or confirm controls and never calls a registration write. That work needs
  its own ADR and is out of scope here.

## Alternatives

- **Read the host page now.** Ticking rows from the host list would save the student a press per
  subject, but it means reading a logged in page, which needs its own boundary, drift handling, and
  review. Rejected for this release; the manual mark serves until then.
- **Fetch the sections when the dock opens.** Simpler, but it adds a request per subject on the
  busiest morning, which quiet mode exists to prevent. Rejected.
- **Open the full overlay on the registration pages as before.** The overlay is modal and covers
  the page the student is filling in, so it cannot sit beside it. Rejected for the two student
  pages; the officer and other registration pages keep the overlay.
- **Store the kit inside the plan.** It would bump the plan schema and travel in plan exports, but
  the kit is a dated cache of public data, not part of the plan. Rejected in favour of its own key.

## Consequences

- A student can prepare the evening before and use the helper on registration morning with no
  request from KCP on those pages.
- The checklist counts what the student marks, not what the page holds; the final review says so
  and never calls a list ready to submit.
- Fit badges reflect the data at prepare time; seats change after it, which the notes state.
- The package grows by the dock, the rows, and their strings, recorded with the budget raise.
- Reading the page, and the fill the owner ruled on, each need their own decision record.

## Amendment, 2026-11-24: the helper card replaces the dock

The owner chose design C2 for the helper. The 360 px dock, its narrow bar, and the phone sheet with
three levels are replaced by a 320 px card that rises 12 px above the launcher at the bottom right,
and spans the screen less its gutters on a phone. From the top it holds a count of the subjects the
page lists, which opens a list of every subject, a more menu, at most one bar (a page KCP cannot
read, a page of another term, or nothing prepared), a queue of chips with each full 8 digit subject
id and a status icon, and the subject in focus with a status band, its section tile, and one action
row.

- **Status comes from the page only.** The manual marks and the status select are gone. A stored
  mark record still validates and is read as one with no choices. On the regular registration page,
  which KCP does not read, every subject stays not added and the card is a list to copy from.
- **The section choice replaces the mark.** The section tile and Other section open a custom
  listbox, never a native select, that sets the section this registration uses, per plan and term,
  and offers to save it to the plan through the existing transaction.
- **Visits.** The card opens on every arrival on a helper page and never takes focus on its own. A
  collapse, by the launcher, Escape, or on a phone a press anywhere on the page, lasts for that
  visit only and is never stored. Hide on this page removes the card and the launcher until the
  next visit.
- **Launcher.** It stays orange, stays visible while the card is open, and toggles it; collapsed,
  it shows a loader while a run adds a subject, a check once every subject is listed, and a dot
  when a subject needs a look.
- **Prepare card.** The per subject review after preparing is gone; the count and the list on the
  registration page read the same facts against the page. The prepare action is unchanged.
- **Announcements.** One polite live region in the helper says a status change, a run step or
  stop, a copy, the page turning unreadable or readable, and the hide. It replaces the fill panel's
  status line in the live region inventory of ADR-0048.

The package budget moves to 350 KiB with this change.

## Amendment, 2026-11-25: the rest of design C2

With the owner's ruling that features come before package size, the parts of the C2 spec the card
build deferred land.

- **More menu.** It holds Use Add for me, Add all for me (ADR-0078), Open the planner, Check again,
  and Hide on this page, the first, second, and fourth on the pre registration page only, and Use
  Add for me only on a host build where Add for me can run. The switch stays open on a press and
  sits above Add all, whose reason line comes and goes with it, so nothing moves under the pointer.
  It is at least 208 px wide, hangs below its trigger at the end edge, and moves by a typed first
  letter as well as the arrow keys, Home, and End; a Thai name also matches the consonant after a
  leading vowel, since a student types ป for เปิดตารางเรียน. The empty states, a plan with no
  subjects and a page term with no plan, keep the header row with the more menu, so a student who
  picked an empty plan can pick another and Hide on this page stays in reach.
- **Placement.** The more menu and the section menu float with floating-ui against the viewport,
  with flip, shift, and a height cap to the room on screen, so neither clips on a short screen. With
  the menus free of any scroller, the queue, the status band, and the section tile scroll together
  inside the card while the header and the action row stay in view.
- **Conditions.** A subject the page lists is conditional when the page named a prerequisite or
  when its section group prints conditions. The condition pill and the several curricula pill carry
  their full sentence as a tooltip and as their description; a printed condition that names an 8
  digit subject id shows as the grade it waits for.
- **Announcements.** Status changes within 500 ms are read as one sentence, the subject and its
  status, or how many subjects changed.
- **Opening.** On the pre registration page the card waits for the observer's first reading, up to
  500 ms, before it opens; on the registration page it opens at once.
- **Details.** The count's name ends with Show all or Back to card, the launcher's dot sits 2 px
  outside its corner, chip ids carry 0.01em letter spacing, a list row's neutral icon is ink soft,
  and the list row's Add for me icon names itself in a tooltip.
- **Not built: section closed.** The status needs the page to say that a section is closed. The
  host contract holds no label for such a message, the toast reader classifies any error toast it
  does not recognise as a refusal, and rule 6 forbids reading or keeping a toast's free text. A
  closed section therefore reads as not accepted, and the section menu still shows a section closed
  at prepare time from the kit.

## Amendment, 2026-11-25: the helper follows the page term, and presses in the closed root

A student tested the helper on a phone and found it showing the plan of another term, and found
that the more menu's items did nothing.

- **Which plan.** The helper no longer shows the planner's active plan. While the page term is
  known it shows a plan of that term: the one the student picked in the more menu on this visit,
  else the active plan when it is of that term, else the most recently updated plan of that term
  (`lib/regis/helperPlan.ts`). The term the header showed is kept in memory through readings that
  drift, until the student leaves the page, and is dropped in a staff session. When the term has
  more than one plan, the more menu opens with them as a group of radio items. When it has none,
  the card says so and names the term, and its one button creates a plan of that term and opens
  the planner on it. The helper never changes the active plan by itself; only that press does.
  A backup section saved from the helper goes into the helper's plan, which changes without
  becoming active and without an undo record. The prepare card in the planner keeps the active
  plan. Until the page term is read, the helper shows the active plan as before.
- **The active plan survives a reload.** The plan root carries an optional `activePlanId`, saved on
  every switch, and a load reopens it while that plan exists. It needs no schema version bump: an
  older root loads unchanged and an older build strips the key. Two open tabs still each write the
  whole root, so the last tab to write wins, as it already did for the plans.
- **Presses in the closed root.** The production build mounts in a closed shadow root, where a
  document listener sees a press inside KCP retargeted to the shadow host. The helper's outside
  press check now decides a press inside KCP with a listener on the shadow root, so a more menu item
  or a section option no longer counts as outside and closes its menu before its click. The
  planner's own menus with a toggling trigger use `usePanelDismiss`, which lets the trigger's press
  count as inside. A production spec taps the closed root's nodes through the DevTools protocol at a
  phone size with touch, since every other regis spec runs on the debug build's open root.

## Amendment, 2026-11-25: the review of the page term build

A design review and a never submit review of the build above found these, and each is fixed.

- **On screen on a wide page.** A phone browser grows the layout viewport past the screen when a
  page is wider than the screen, and the card and the launcher, fixed to its bottom right corner,
  sat off screen. On a helper page an invisible fixed probe measures the layout viewport and the
  visual viewport gives the part on screen; the band on each side is set as custom properties on
  the app root, and the card, the launcher, and the toast region add them to their offsets. A pinch
  zoom sets none, as for the panel's keyboard inset. The bands follow the on screen keyboard too, so
  a collapsed launcher stays above it.
- **Toasts on a phone.** With the planner closed the toast region floats above the card, or above
  the launcher when the card is collapsed or leaves no room above it, so a toast never covers the
  checklist count or the card's controls.
- **Names.** Copy ID takes its name from its visible label followed by the subject id, the
  unreadable bar's words carry a space between the state and Check again, and the disabled Add all
  item is named by its label, with its reason as its description.
- **A list row of another section** names the group the page lists, as the card's tile does.
- **Touch.** A queue chip shows no tooltip on a coarse pointer, where a tap would leave it up.
- **The page term in storage.** Create a plan for this term (สร้างตาราง) makes a plan of the term
  the header shows and saves it, and the active plan id, to storage. Rule 6 keeps every host read in
  memory, so this is recorded as the one derivation a host read may leave in storage: it happens
  only on the student's own press of a KCP control that names the term, the term passes the plan
  schema (a four digit year and a semester of 1, 2, or 3) before it is used, and it is public
  timetable data, never the student's identity. It awaits the owner's acknowledgement.

## Amendment, 2026-11-26: a calm helper on a phone, the page term, and prepare where the student is stuck

The owner tested the helper on Firefox for Android on the live pre registration page (app.a1e43722,
term 2/2569, one plan per term) and found it confusing at rest, unable to add, and showing the
wrong plan during a reload. Each finding is fixed as follows.

- **No plan before the page term.** A reload showed the active plan, of term 1/2569, over the half
  loaded page and then switched to the 2/2569 plan once the header was read. On the pre registration
  page the helper now names no plan while a reading may still bring the page term: the card shows
  one quiet row, กำลังอ่านภาคการศึกษาจากหน้านี้, with no subject chips and no count, and the launcher
  shows เช็กลิสต์ with no count. Only when no reading can bring the term (the observer is off, the
  wait of 15 seconds on each arrival ran out, or the page is the registration page, which KCP does
  not read) does it fall back: to a plan of the term this document last read from a page, kept in
  memory as a hint, else to the active plan. A fallback plan is marked unconfirmed and the card's
  header names its own term (ตาราง 1/2569), so it is never taken for the page's. A term read from the
  page always replaces the fallback; the remembered term is never proof. Nothing is stored. This
  supersedes "Until the page term is read, the helper shows the active plan as before" above.
- **No entry toast on the helper pages.** The planner's entry toast named the active plan, of the
  wrong term during that reload, and sat over the card's controls and footer. It no longer shows on
  the two helper pages, and one shown elsewhere goes for good when the host navigates to them. Since
  the amendment of 2026-11-27 both rules cover every registration page.
- **A calm start on a phone.** On a narrow screen (below 640 px) a visit now starts with the card
  collapsed to the launcher, so the countdown and the form read first; the student opens it with
  the launcher. There a later visit in the same document follows the student's own open or
  collapse, made with the launcher or Escape. A wide screen still opens the card on every visit, as
  owner answer 5B asks. While the card is open the launcher names the checklist alone, since the
  card's header carries the count, so one count shows at a time. On both helper pages the launcher,
  and the card above it, sit 64 px higher, clear of the host's back to top button, a 56 px round
  button 16 px above the bottom right corner on every host route (Section 6.1 asks KCP never to
  cover host floating elements). Its position is a measured constant, not read from the page, since
  rule 6 does not let KCP read that element.
- **Prepare where the student is stuck.** A student who reached pre registration without preparing
  saw Add for me held by ยังไม่ได้เตรียมข้อมูล and no action, since the prepare card refuses on every
  registration page. On the pre registration page only, the helper's bar for a plan with nothing
  prepared now offers เตรียมข้อมูล on the same line as the reason. It runs the same kit pipeline as
  the prepare card: one subject at a time with a pause, retries off, Cancel aborting the read in
  flight, and the existing done and failed outcomes; a failed run says อ่านข้อมูลไม่สำเร็จ and offers
  the press again, which is the student's own. It starts only from a trusted press, never on its
  own, never while a fill run is active, and a fill run cannot start while it reads (ADR-0078). Its
  reads go through the background gateway to the public API, never through the page. The refusal
  scope above therefore narrows: prepare is refused on every registration page except pre
  registration from the helper's own press (`prepareRefused` in `lib/regis/route.ts`); the
  registration page, the first come page, offers no press and refuses, and the prepare card in the
  planner keeps refusing on every registration page, on pre registration with a line that points to
  the helper. Owner ruling 2A, prepare at a calm time, stays the advice; this is the exception for a
  student who would otherwise lose the window, which closes 2026-11-27 at 16:30. The reason now
  shows once, in the bar, and the note under Add for me that repeated it is gone; the button points
  at the bar's words.
- **Tests.** Unit tests cover the plan pick before and after the term (pending, fallback, remembered
  hint, confirmed), the entry toast choice and schedule on the helper pages, the prepare route scope,
  press only start, and fill exclusion, the kit bar's states, and the narrow start. Debug specs
  sample the helper every 25 ms through a reload whose page first renders nothing for 2.5 seconds,
  with the active plan of another term, and find no chip, no count, no other plan, and no entry
  toast; prepare on the replica from noKit to a stored kit and a working Add for me, with the press
  absent on the registration page; and open the card from the launcher at a phone size.

## Amendment, 2026-11-26: review fixes to the calm phone helper

A review of the amendment above with touch emulation found these, and each is fixed.

- **No count on the launcher for a plan of an unread term.** Once the wait for the page term ran
  out, the helper fell back to a plan of another term, labelled with that term inside the card. On
  a phone the card is folded and the launcher is the only surface, and it showed that plan's count
  as if it were the page's, and kept it for good on a direct load of the registration page, which
  KCP does not read. The launcher now shows a count, and the all added check, only for a plan of the
  term read from the page, and names the checklist alone otherwise.
- **The wait for the term outlasts a slow page.** The wait ended on a fixed 15 s timer, so a page
  still empty after 15 s, as at the registrar's busiest time, got the fallback plan of another term
  until it loaded. After 15 s the wait now ends only once a reading finds the panel with no term in
  its header; a page that shows no panel keeps the reading row up to a 60 s ceiling, after which it
  gets the labelled fallback. This supersedes "the wait of 15 seconds on each arrival ran out" above.
- **The rise above the back to top button needs a tall screen.** The 64 px rise took 64 px from the
  card's height, and on a phone turned on its side, 915 by 412, the card was left 252 px for about
  292 px of content, so the action row cut the section tile and the subject name. The rise is now
  the token `--kcp-helper-lift`, 64 px on a screen at least 30rem tall and 0 below it, where the
  launcher covers the host's back to top button as it did before the rise; the card keeps its 12 px
  above the launcher either way. A visit treats a touch screen whose short side is under 640 px as
  a phone (`isPhoneScreen` in `lib/ui/breakpoints.ts`), so a phone on its side starts with the card
  folded too. A landscape screen under about 390 px tall still scrolls the card's subject. The 64 px
  was measured from a screenshot of app.a1e43722 at 412 px and is worth checking on the live page at
  360 and 412 px, with the Firefox bottom toolbar shown.
- **Prepare only for the plan of the page term.** The bar offered เตรียมข้อมูล for a fallback plan of
  another term, which would read that term's subjects at the busiest time for a plan fill refuses.
  It now offers the press only for a plan of the term read from the page.
- **A held press while another plan prepares.** One prepare runs per document, and a press for
  another plan while one read did nothing and said nothing. The press is now held with its reason,
  กำลังเตรียมข้อมูลของตารางอื่นอยู่, on hover, in its name, and in the error toast a press shows.
- **Tests.** Unit tests cover the launcher with no count for an unconfirmed plan and its count once
  the term is read, the wait that holds while the page shows no panel and ends at the first panel
  with no term, the phone check on its side, the landscape start folded, the bar with no press for
  an unconfirmed plan, and the held press with its toast. Debug specs sample the launcher on a phone
  through a reload whose page stays empty for 19 s and find no other term's count, and open the card
  on a phone on its side with nothing cut off and its action row clear of the launcher.

## Amendment, 2026-11-26: the owner consents to the page term in storage

The amendment of 2026-11-25 on the review of the page term build recorded one derivation a host read
may leave in storage and left it awaiting the owner's acknowledgement. The owner consented on
2026-11-26: the term read from the page header may be stored in the plan created from the helper's
สร้างตาราง {term} button.

- **What the path stores today, unchanged.** The card shows the button only when the student has no
  plan of the page term. Its press calls `switchOrCreatePlanForTerm` with the page term from the
  helper's plan pick, and `createPlan` makes a plan whose `year` and `semester` are the page term and
  whose name is the default, ตาราง {semester}/{year} in Thai. The plan store saves it with the active
  plan id to `storage.local` under `kcp:v1`. The term passes the plan schema before it is saved, and
  it is public timetable data, never the student's identity.
- **Only on a press.** The plan is made only on the student's own press of the button, which names
  the term it makes; showing the card, reading the header, or a fallback term never writes one.
- **Tests.** `HelperTerm.test.tsx` renders the card on a page of a term with no plan, finds nothing
  created before the press, and after a press of สร้างตาราง 2/2569 finds the new active plan with
  year 2569 and semester 2 and the planner open; `switchPlanTerm.test.ts` covers the create and the
  switch to the most recently updated plan of the term.

## Amendment, 2026-11-27: the regular registration page and a stale kit

A read only study of the helper on the regular registration page, where KCP stays at L0 under rule
6, found four places where the helper said something the code does not do. Each is fixed as
follows, with no change to what KCP reads or sends on any registration route, beside two
guards on fill that narrow it further.

- **A route reason for Add for me.** On `#/registration` the host check never runs, so the build
  read as still being checked and Add for me said KCP was checking the page version for as long as
  the page stayed open. `addForMeBlock` in `lib/regis/helperStatus.ts` now takes the route as its
  first fact: every page but pre registration gets the reason `otherPage`, which says Add for me
  works on the pre registration page and the student types the subject id from the checklist. The
  checking reason is reachable only on pre registration.
- **Route scoped copy.** The hidden term line of an unconfirmed plan said KCP could not read the
  term; on regular registration KCP never tries, so that page now says the plan is shown for its
  term and KCP does not read the page, and pre registration keeps the could not read wording. The
  prepare refusal no longer claims the system is taking registrations, so it fits all six
  registration routes, and the choose subjects step reason no longer promises a step that may not
  come after the window closes. No observer timing changed.
- **One predicate for the prepare card.** The planner's prepare card pointed the student to the
  helper's Prepare data whenever the route was pre registration, though the helper offers that
  press only for a plan of the page term, under its kit bar, and for the plan it follows.
  `canPrepareInHelper` in `lib/regis/helperBar.ts` now decides both; the kit bar adds its own
  connected search check, and the card points to the course search page whenever the predicate is
  false. Where it points to the helper, the card names the press by the label the helper shows,
  Prepare again over a stale kit and Prepare data otherwise.
- **A stale kit kept as reference, fill still blocked.** A kit older than seven days was dropped
  whole, so the kit bar said nothing was prepared and the saved section choices and alternatives
  vanished, though kits prepared from 2026-11-23 expire before regular registration opens. The
  stale kit is now a separate, display only field (`staleKit`): the checklist shows its choices and
  other sections, the chosen section labelled as from older data, and the kit bar says the data is
  older than seven days. Where the bar offers Prepare again it says to prepare at a quiet time,
  and where it offers no press, as on regular registration, it names the course search page. The
  fill input stays strictly fresh: `kit`, the one input `fillTarget` reads, stays null for a stale
  kit, so a stale kit yields no fill target, and Add for me is blocked with its own reason,
  `kitStale`, ahead of `noKit`. Under the kit bar the focused row reads the bar's words for that
  reason, as it does for `noKit`, so the card gives one instruction; elsewhere, on list rows and in
  the more menu, the reason says only that the data must be prepared again first. Prepare stays
  refused on every registration route except the helper's own press on pre registration.
- **Tests.** Unit tests cover the block order with the route first, the host check sending nothing
  on regular registration, the shared prepare predicate's negative cases, and a stale kit giving no
  fill target. A hand written replica of the regular registration page, modelled on the host build
  of 2026-11-23 only, backs a debug spec that proves L0 in each of its states and over the pre
  registration markup: the route reason and the not read term line show, no fill press exists, the
  observer stays waiting, no host check or other request is sent, and no host control is pressed.
- **A route check at the press.** The host check's verdict stands for the whole document, so a
  student who moves inside the page from pre registration to regular registration keeps a verified
  build. Hiding the press was the only barrier there; `startFill` now also starts nothing unless the
  route is pre registration, and a debug spec makes that move and proves nothing is pressed.
- **The add, change, and withdraw area.** Its controls are kept from fill first by the add card
  anchor, whose heading needs the (ล่วงหน้า) span the regular page does not print. Below that,
  the area has the same table, block, and button shape as the local add, so the local add
  resolver now also reads the label of the button after its block and needs ดำเนินการต่อ
  (Continue), rather than relying on that button's deep orange colour. A unit test stubs the
  anchor to each card and area of the replica, including a variant whose confirm is deep orange,
  and finds no control of the area or of the queue panel.

## Amendment, 2026-11-27: results per subject, the hand off line, and the carried choice

The owner answered three open questions on 2026-11-27 (A2, B1, C1). Each changes only what the card
shows; what KCP reads, stores, and sends on every registration route is unchanged, and the regular
registration page stays at L0.

- **Results per subject (A2).** On the complete step every planned subject read as submitted once
  any row did, and the count read every planned subject as done, so a subject missing from the
  submitted list read as submitted too. The unit test that locked that collapse is replaced. Each
  subject now reads from the list alone: one in it reads as submitted, awaiting result, and one
  missing from it gets a status of its own, not in the submitted list, in the warning tone; the
  count is the subjects submitted over those planned, so the launcher's check shows only when every
  planned subject was submitted. The announced results keep their own row states, and the not
  granted on a condition result is now one of them rather than being merged into not granted, but
  no announced result has been seen live, so each still reads as submitted and waiting; a later
  change flips only the mapping in `lib/regis/helperStatus.ts`, since the submitted count takes the
  statuses of the submitted row states from that mapping rather than naming one status.
- **The hand off line (B1).** The final line of the design, that once every planned subject is on
  the host list the student checks the list and presses ดำเนินการต่อ themselves, and that it is sent
  once, was never built with the card. It is now one line at the foot of the card, shown only on
  pre registration, the one page where KCP knows the state, while the page can be read, no run adds,
  the host's confirm dialog is not open, the submitted list is not yet shown, and every planned
  subject is on the list as planned, with another section, or on a condition (`showsHandOff`). It names the host control by its label as
  text only, holds no control, points at and highlights nothing on the page, takes no focus, and
  wraps at a phone width with nothing cut or covered.
- **The carried choice (C1).** Section choices are kept per plan and term with no route key
  (`lib/regis/choices.ts`), so a section chosen on pre registration shows on regular registration as
  the plan's choice. It keeps carrying, with no storage change, and on regular registration the
  focused subject and that option in the section menu now say it was chosen earlier for this term.
  The label does not say pre registration: the stored record cannot tell the two pages apart, so a
  section chosen on regular registration in an earlier visit, or one chosen with pre registration
  never opened, would read as a pre registration choice, a claim KCP cannot back. Chosen earlier
  for this term is true in every case it shows. A choice the student makes again on that page drops
  the label for the rest of the visit; a later visit labels it again, which stays true.
- **The entry toast.** It now stays away from every registration page, the officer, queue, and other
  pages included, and the rule that hides one shown elsewhere uses the same route predicate, so the
  show and leave rules stay one rule. This is a choice about a busy page, not a quiet mode fix,
  since the toast sends no request.
- **Tests.** Unit tests cover each result state, the count, and the hand off predicate in every
  state; component tests cover the line only in the all added state and on neither the submitted
  list nor regular registration, the carried label on both routes, and the toast on each
  registration route. Debug specs check the not sent status and the count on the replica's complete
  step, the line at a 360 px width with the text fit scan clean and focus unchanged, and the carried
  label as the hash moves from pre registration to regular registration and back.
