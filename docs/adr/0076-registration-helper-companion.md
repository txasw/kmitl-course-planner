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
refused on the registration pages with a one line reason before any request is sent, a run that
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
