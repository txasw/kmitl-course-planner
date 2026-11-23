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
gateway, one subject at a time with a short pause, and only when the student presses it. It is
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
demand, so at rest it sits below a host dialog's buttons. Each row shows the subject id with a copy
button, the name and credits, the planned section and its practice pair with every meeting and exam
window, the condition and duplicate code notes, the other sections with their fit, and the
student's mark: not added yet, added on the page, added another section, conditional on a
prerequisite, or skipped. The header shows the plan, its term with a prompt to compare it with the
page, the credits, and a fixed line that KCP never submits and that the student presses
ดำเนินการต่อ and confirms themselves; on pre registration it adds that pre registration can be
submitted only once, and on regular registration that the student checks the list. A final review
lists the rows that differ from the plan first, then the conditional rows and those whose curriculum
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
