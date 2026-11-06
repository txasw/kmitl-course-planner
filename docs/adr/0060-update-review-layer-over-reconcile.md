# 60. Update review layer over reconcile

Status: Accepted
Date: 2026-11-06

Amends brief section 6.6 step 5 (the summary banner, the detail sheet and the grid badge rules)
and the 6.6 sentence that manual refresh reports through the revalidation banner and its detail
sheet. Amends ADR-0055 (the revalidation banner as the preview home of the run outcome, and the
`PreShareNotice` action that opens the detail sheet) and the ADR-0048 live region inventory (the
banner's polite region). Leaves the reconcile of brief section 5.3 and 6.6 step 4 unchanged: the
API stays the source of truth, snapshots stay a cache, and upstream data is applied on every run.

## Context

Revalidation applies upstream data to every snapshot as soon as it arrives, then reports the run
in a banner of about 40 px above the grid and in a detail sheet behind it. The owner asked for an
explicit acknowledgement when something that matters changes, the exam schedule being the case
named, and found the current report too easy to miss and too noisy to trust.

The noise comes from seats. During pre registration the enrolled, pre registered and queue counts
move by the minute, so almost every run classifies some entry as `seats_changed`, the entry turns
`changed`, its block gains a warn badge, and the banner counts it. A student who sees a change
every time learns to ignore the badge, and then misses the time or exam change it was built for.

The report is also not durable. Whether a change was seen lives only in the latest run. A later
run that finds nothing new against the already updated snapshot reads as clean, so a change the
student never looked at disappears from the report once the next run lands.

## Decision

Reconcile is unchanged. A review layer sits on top of it, records what changed against what the
student last reviewed, and asks for an acknowledgement. It never holds data back.

Change kinds split into two classes.

- Material: `time_changed`, `exam_changed`, `room_changed`, `pair_changed`, a section that turned
  closed, `missing`, and any time conflict or exam overlap that a change in the run created.
- Ambient: seat counts, including a section turning full, and `teacher_changed`. Seat counts
  update the display silently from the latest verification, as 6.6 already requires. A teacher
  change is listed only beside a material item of the same entry and never asks for review alone.

A run whose changes for an entry are all ambient leaves the entry `verified`; a seats only run no
longer sets `changed`. An entry is `changed` exactly while it holds an open review of a material
kind other than `missing`, so the warn badge means the student has something to read. The danger
badge rules of 6.6 step 5 stay: `missing`, a new time conflict and a discovered exam overlap read
danger, and nothing is deleted silently.

Each material change persists on its entry as an optional field,
`review { kinds, before, detectedAt, notifiedAt }`. `kinds` lists the open material kinds, `before`
is the snapshot as the student last reviewed it, `detectedAt` is the time the first of the kinds
was found, and `notifiedAt` is the time the student was last shown the item, null until then. The
field is optional in `planEntrySchema`, so every stored blob without it still parses and the
storage schema version does not change; a schema test parses a v1 fixture blob to hold that.

Runs merge into an open review rather than replace it.

- The earliest `before` is kept, so the dialog always compares against what the student last saw,
  not against the previous run.
- Kinds are unioned. A kind added by a later run sets `notifiedAt` back to null, since the item is
  new to the student.
- A kind drops when a later run returns the value in `before`, for example an exam moved and then
  moved back, or a section closed and reopened. The review is cleared when no kind remains.
- A clean run, one with no difference against the current snapshot, never clears a review, since
  the difference from `before` still stands. Only an acknowledgement or a reverted value does.

Acknowledging an entry clears its review and sets it `verified`. JSON import strips `review`
from every entry, because 6.6 resets imported entries to `unverified` and the first check after
import reconciles them; an exported plan therefore never carries another device's review state.

One review surface, the `UpdatesDialog`, replaces `RevalidationDetailSheet`. Its title is
ข้อมูลในตารางมีการเปลี่ยนแปลง, and its one sentence body says the plan already shows the latest
registrar data. Items are grouped by entry in a fixed order: new clashes and missing, exam
changes, time and room, then the rest. Each item shows the old and new values as เดิม and ใหม่,
with exam dates in the Buddhist year through the existing exam formatter. Per item actions are
ดูในตาราง, which closes the dialog and pulses the block, and for a missing entry นำออกจากตาราง
with undo. The footer carries รับทราบทั้งหมด as the primary action, which acknowledges every item,
ดูภายหลัง, which sets `notifiedAt` and closes, and a ตรวจสอบอีกครั้ง link that runs a manual check.
Unchanged and ambient only entries sit in one collapsed group, so the dialog still answers what a
run checked. From 640 px it is a centred dialog; below it is a full height bottom sheet.

The dialog reads the items from the plan entries, not from the latest run, so it lists the same
items after a reload. An entry is an item while it holds an open review, and also while it is
still not listed after its review was acknowledged, since it stays on the grid with its danger
badge and its remove action. A clash puts an item in the first group only when a time or exam
change in its review created it. ดูในตาราง counts as ดูภายหลัง for the items shown, then focuses
the earliest block and pulses it twice in the brand orange, the selection accent, rather than in
the danger tone that marks a blocker during a drag; a section with no meeting marks its shelf
row. A removal runs through the plan store, so the declared pair goes with it and the plan's undo
window applies, and every item it took stays listed as นำออกแล้ว with its undo meanwhile. Escape,
the close button and the scrim all count as ดูภายหลัง.

While any review is open, an `UpdatesIndicator`, มีการเปลี่ยนแปลง {count} รายการ, sits at the
right of the plan view tabs and reopens the dialog, and the phone ตารางเรียน nav item carries a
dot. The indicator announces its first appearance through `StatusAnnouncer` and is not a live
region itself.

The dialog opens on its own once per new set of items, only when the student is idle.

- It opens after an automatic run, on panel open or plan switch, that leaves an item with a null
  `notifiedAt`, and opening sets `notifiedAt` on every shown item.
- It waits while a drag is active, while a popover, menu or sheet is open, while focus is inside
  the search form, and while the panel is in preview, then opens at the next idle moment in edit.
  The catalog sheet over the grid on the medium tier counts as a sheet, and so does the catalog
  pane below 640 px, which hides the grid the dialog points to. A hover card does not count,
  since it opens on its own. Idle means the panel stays that way for a settle of 600 ms,
  which any busy moment restarts, so the dialog never lands on a gesture that just ended. The
  surfaces report themselves through an attention store that the shared popover recipe, the
  bottom sheet and the modal dialog write, so a new popover is covered without a list to keep.
- An offline run or a partial run never opens it. The items a partial run did record still show
  in the indicator.
- The run that follows the first add of a new plan still executes, since the new plan becomes
  the active plan, a switch that 6.6 revalidates on, and the run is served from the cache the
  search just filled. Only its automatic opening is suppressed, because the entry came from a live
  search moments before and a modal at that point interrupts the add.
- A manual check in edit that finds new material items opens the dialog directly, whether it ran
  from the stats bar or from the dialog link. A manual check from the preview status slot leaves
  its items to the indicator and the `PreShareNotice`, and the dialog opens at the next idle
  moment in edit, as an automatic opening does.

The review surface opens only in edit, where the acknowledge and remove actions live, so no
mutating control enters the preview DOM as brief section 6.4 and ADR-0022 require. The preview
`PreShareNotice` keeps its count and its one action, which now switches the panel to edit and
then opens the dialog.

`RevalidationBanner` is retired. In edit, the run outcome is a quiet item in the stats bar under
the grid: a success check, ตรวจสอบแล้ว {time}, and an icon button ตรวจสอบอีกครั้ง. An offline or
partial run uses the same item in warn ink with a retry and the unverified meaning of 6.6 step 6.
In preview, the same status and retry render in a slot of the preview toolbar, outside the capture
node, so the unverified state and its retry stay visible while sharing and the poster stays as
ADR-0055 records it. The retry replays upstream data and is not a plan edit, as the banner's
refresh was before it. Manual refresh reports through this status and the dialog, not through a
toast. The catalog refresh is relabelled โหลดผลค้นหาใหม่, so the two refresh actions no longer
share a label. The banner's polite region leaves the ADR-0048 inventory, and the status item in
either mode announces through `StatusAnnouncer`. The banner was the only node that spoke a run
outcome in preview, and the ADR-0048 amendment records that preview carries no announcer, so
`StatusAnnouncer` now mounts in preview as well. There it speaks only the run status, since
preview has no search.

As built, one function words the status for the item and for the announcement, so the two never
differ. The time is the plan's data date, the oldest verification the poster states, read as a
clock time for a check today and as a date and time otherwise, so the item reads correctly after
a reload before any run of the session; a plan never verified reads ยังไม่ได้ตรวจสอบ. A run that
found changes adds its changed and missing counts after the time. Only a run the student asked
for is announced, as only a user search is; a run records whether it was manual. Until the
`UpdatesIndicator` lands in the tab row, the status item also carries the banner's details action
while any review is open, so the dialog stays one action away in edit. The stats bar ends with
the status at every tier and shows the full text on a phone as well, wrapping to a second line;
an icon and time only form there is left for the compact stats line.

## Alternatives considered

A sync action that applies upstream data only on approval was rejected. It reverses the core
invariant of 5.3, leaves the grid and every export stale until the student approves, and gives the
student nothing the review layer does not, since the review already shows the old value beside the
new one.

Keeping whether an item was seen in memory, as the id of the last notified run, was rejected
because it is lost on reload, so an acknowledgement would not be durable and the dialog would
reopen for changes already read.

A toast was rejected because brief section 8.2 reserves toasts for outcomes not otherwise visible,
and the list needs room for old and new values and per item actions. Notifying on seat changes was
rejected because the counts move by the minute during pre registration, which is the noise this
record removes. Treating a teacher change as material was rejected because it does not change
when or where the student has to be, and the detail list already shows the current teacher.

Keeping the banner for changed, missing, partial and offline runs was rejected because the
indicator and the dialog now carry changes and the stats bar carries the offline state, so a
banner would be a second surface for the same state and would cost grid height. Opening the
dialog in preview, or a read only copy of it there, was rejected for the reason ADR-0055 gives for
the detail sheet. Suppressing the whole run after the first add was rejected because 6.6 runs
revalidation on the switch to the new plan and the run costs only a cache hit.

## Consequences

A block's warn badge now means a material change the student has not reviewed, and it stays until
the student acknowledges it or upstream reverts it, across reloads. Seat counts stay current with
no badge. The dialog opens rarely and only at a quiet moment, and the indicator keeps an unread
change one action away on every tier. The grid gains the banner's height.

The plan blob grows by one optional field per reviewed entry, holding a snapshot. A build older
than this record drops the field on load because the plan schema strips unknown keys, so a
downgrade loses open reviews and keeps the data, which reconcile already holds current.

The live region inventory test in `src/features/shell/liveRegions.test.tsx` drops the banner and
covers the announcer in preview, changing together with this record as the ADR-0048 amendment
requires.

The end to end specs that click the banner's refresh and read its summary move to the stats bar,
and those that trigger a manual check that finds changes must dismiss or acknowledge the dialog
before the next step.

## Amendment, 2026-11-06: the updates indicator on each tier

The indicator ships as the decision above places it, with these details settled in the build.

- Its count is the number of items the dialog lists, read through the same rule, so a section
  still not listed after its review was acknowledged keeps the indicator, as it keeps its place
  in the dialog, until the student removes it.
- On the medium and wide tiers it is a warn bordered chip at the right of the plan view tab row,
  outside the tablist, since a tablist holds tabs only. The row heights become minimums, so under
  a coarse pointer the row grows to the chip's 44 px target rather than clip it.
- Below 640 px the plan pane has no tab row, so the same chip heads the plan pane in both plan
  views, and the ตารางเรียน nav item carries a warn dot. The item's accessible name adds the
  indicator wording with the count, so the dot's meaning is not carried by colour alone.
- `StatusAnnouncer` reads the indicator wording when the active plan goes from nothing to review
  to some items, as a check records changes or a switch lands on a plan with open reviews. A
  count that changes while the chip shows stays silent, and a plan that already had items when
  the panel opened says nothing, because the indicator did not just appear. No live region is
  added, so the ADR-0048 inventory is unchanged.
- The indicator renders in edit only, as the dialog it opens does. In preview the
  `PreShareNotice` carries the count.
