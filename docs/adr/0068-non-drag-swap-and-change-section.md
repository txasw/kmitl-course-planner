# 68. Non drag swap and change section paths

Status: Accepted
Date: 2026-11-14

Amends ADR-0024 (course drag keyboard parity and its block move and swap amendment). Builds on
ADR-0025 (one transaction primitive and one undo record) and ADR-0049 (the selected courses view).

## Context

A placed section can move to another section of its subject, and a blocked section can take the
place of the section that blocks it, but both outcomes were reachable only by dragging a block on
the grid. ADR-0024 kept those gestures pointer only and argued parity through the remove control
on each block and the add buttons in the catalog: remove the old section, then add the new one.

That argument holds for reaching the outcome, but it splits one change into two steps. Between
them the plan holds neither section, the remove raises its own undo, and the add that follows
clears that undo, so a student who changes their mind cannot restore the original with one
action. It also asks a keyboard, touch, or screen reader user to find the subject in the catalog,
which lists it only while a search that includes it is on screen. The catalog card of an added
course said to change sections by dragging the block, which names the one path these users cannot
take.

## Decision

Two non drag paths reach the move and the swap, each through the same transaction a drag commits,
so the change is atomic and leaves one undo record.

Replace in the blocked notice. When an add is blocked by a time conflict, the feedback strip
offers, after the alternative sections, one action per blocking subject that reads แทนที่
{subject} {section}, Replace {subject} {section}. It removes the blocking section with its pair
and adds the blocked section with its pair through `swapSectionInPlan`, which is the swap the
drag commits on a swap target. The strip offers a replacement only when it would succeed:
`replaceOptions` in `lib/planner/sectionChange.ts` removes that subject's blocking sections from
the plan and checks the blocked group against what is left with `checkPlacement`. A replacement
that would still leave a time, exam, or duplicate conflict with another entry is not offered, so
the notice never carries an action that changes nothing. Exam and duplicate conflicts do not
produce a replacement of their own, because the request to replace concerns a class that sits
in the same time; a blocker that clashes by time and by exam is still offered, since removing it
clears both.

Change section in the block details and the selected view. The block detail surface and each
card of the selected courses view carry a เปลี่ยนกลุ่มเรียน, Change section, disclosure. It lists
every other section group of the subject that is open and fits the plan once the current section
and its pair leave, ordered by earliest start, and a choice moves the entry through
`moveSectionInPlan`. `changeOptions` in the same module derives the list: it takes each section
of the course with its declared pair as one option, drops the group already placed, drops a group
with a full or closed member, and keeps a group that `checkPlacement` accepts. The disclosure
needs the subject's full course, which a plan snapshot does not carry, so it resolves the course
from the current catalog through `resolveCourseForSubject`, the same lookup a block move uses.
When the catalog does not list the subject in the plan's term, the disclosure says that a search
for the subject is needed first, and when no other group fits it says so.

The list is not capped at two, unlike the alternative chips of the blocked notice, because a
student changing a section is choosing among all of them rather than recovering from a refused
add. It does not reuse `alternativeSections` for the same reason, and because that helper lists
each half of a pair as its own chip and does not consider seats.

After a change, focus lands on the new section: from the block details, on its earliest block or
its unscheduled shelf row, or on the grid when the current view shows neither; in the selected
view, on the disclosure toggle of the same subject card, which outlives the change. The undo toast speaks the move or the swap as it does for a drag.

The catalog hint on an added course names the two paths instead of the drag.

## Amendment to ADR-0024

The move and the swap now have keyboard, touch, and screen reader paths, so ADR-0024's parity no
longer rests on remove then add. The drag gestures themselves stay pointer only, and the
reasoning against a keyboard picker layered over the grid still holds: the new paths are ordinary
buttons in surfaces that already take focus, with no roving selection and no second announcement
vocabulary.

## Alternatives considered

Offering a replacement for every blocking subject, whether or not it would succeed, was rejected.
It matches the swap target a drag shows over every blocker, but a button that changes nothing and
answers with the same blocked notice is a dead control, and the drag can afford it only because
the pointer user sees every blocker at once. Listing the options as a menu attached to the block
was rejected because the detail surface is already the one place touch and keyboard users reach a
block, and a second surface would split its actions. Reusing the alternative chips of the blocked
notice for change section was rejected for the reasons given above.

## Consequences

Every plan mutation a drag can make is also reachable by keyboard, touch, and screen reader in one
step with one undo. The change section list depends on the catalog listing the subject in the
plan's term, the same limit a block move has; closing it would need the worker to fetch a course
on demand, which this decision does not add. The replace action and the change list are derived
by pure functions with unit tests, and both commit through `applyPlanTransaction`, so they inherit
pair atomicity, the term check, and the exam hard block without checks of their own.

## Amendment, 2026-11-22: a choice shows what a student picks by

The owner reviewed the change section list on a phone and found each choice read only as a section
code and its times, one run of text in one weight. A student picks a section by which group it
is, the day, the time, the room, and who teaches, so each choice now shows those as separate
parts. The section code is a neutral chip with a bold number, read by a screen reader with the
section label before it. Each meeting follows on its own line as a bold short day, a time in
tabular figures, and its place behind a pin glyph in the quieter ink; a section with several
meetings lists every one, and an online class shows no place. The seat line follows in the
success ink, from the same summary the catalog rows use. A pair lists both halves, each with its
chip, its lecture or practice label, its meetings, and its seats. The instructors of the group,
each once, sit on one line under the card's parts, in the panel's language.

The whole card is the press target, through a stretched layer of its select button, and the
button keeps the selection, keyboard, and focus behavior the list had. The instructor line sits
outside the button, since a button can hold no tab stop of its own, and the button names it as
its description, so a screen reader hears the instructors with the choice. A press on the
instructor line scrolls it rather than choosing the section. Seat and conflict state stay in
view: every choice is open and fits by construction, the list label says so, and the seat line
shows the count. The orange stays on actions only; the chip and the card are neutral, and the
card's edge darkens on hover. The long instructor line is the owner approved ellipsis exception
recorded in the ADR-0048 amendment of the same date.

A single run of text with stronger punctuation was rejected, since the owner asked that the parts
not share one style. Showing the instructor line inside the button was rejected because the
line has to scroll on its own and be a tab stop, which a button cannot hold.
