# 55. Exports carry a data date instead of verification badges

Status: Accepted
Date: 2026-11-06

Amends ADR-0027 (the clause that the block revalidation badges render in the capture; the
unscheduled shelf clause stays), brief section 6.6 composition rule two (the poster capture
includes the revalidation badges as rendered on the blocks), and the brief section 6.4 clause
that the revalidation badges still render in preview mode. Revalidation still runs on open in
preview, and its outcome stays visible there in the revalidation banner, which sits outside the
capture node, while the poster blocks carry no badge.

## Context

ADR-0027 made every export honest about verification by drawing the edit mode badges into the
poster: a status dot, a hatched fill and a danger ring on a missing or conflicting block, and a
warn dot on a changed one, with the same tone pill on a shelf row. The owner reported that a
shared image carried a red dot on a block and no way to read it. The badges are an editing
signal for the plan owner. The people who receive the image cannot open a popover, cannot
acknowledge a change, and do not know what the dot means, so a mark that helps the owner reads
as noise or as an error to everyone else. The marks also scale with the template, so on the
phone wallpaper the dot is a few pixels wide and on the A4 print it is a blot.

The fact behind the badges still matters at the moment of sharing. A plan can hold a section
that upstream no longer lists, or two sections that a later time or exam change put into
conflict, and an image that hid both would present them as confirmed.

## Decision

The poster renders no verification or conflict glyphs. `EventBlock` takes a `showVerification`
prop, true by default, and the read only grid path in `DayLanes` passes false, so a poster block
has no status dot, hatch, danger ring or `data-verify` marker, and its accessible name carries no
badge text. `UnscheduledShelf` takes the same prop and the poster passes false, so a shelf row has
no tone pill. The change lives in the poster render path, which is both the preview stage and the
capture node, so preview and every PNG, clipboard and share export stay identical. Edit mode keeps
every badge.

Honesty moves to text in the poster footer. A pure `posterHonesty` in `lib/planner` reads the plan
entries and the time and exam conflict maps the planner already derives, and returns three facts:
the data date, the missing entry count, and the conflicting pair count.

- The data date is the oldest `lastVerifiedAt` across the entries that have one, because a poster
  is only as current as its least recently checked section. An entry with no `lastVerifiedAt` was
  added since the last check from a live search, so it does not hold the date back. When no entry
  has a valid `lastVerifiedAt`, as for an imported plan before its first check, the date is
  reported as unverified rather than invented.
- The missing count is the number of entries whose status is `missing`.
- The conflicting pair count is the number of distinct section pairs that clash on time or on an
  exam window, counted once per pair even when the pair clashes both ways.

`PosterDataLine` renders these beside the watermark in the footer row, in the same quiet ink soft
style and em relative size. Its first line always reads ข้อมูล ณ followed by the date and time in
the Buddhist year form the detail list uses, or ยังไม่ได้ตรวจสอบข้อมูล when nothing has been
checked. A second line appears only when there are missing entries or conflicting pairs and states
each count in a plain sentence. An empty plan has no data line.

The text export keeps its short missing parenthetical, since a chat message has no footer to carry
a separate note and the marker sits on the line it describes.

Before the user shares, a `PreShareNotice` follows the preview toolbar, outside the capture node,
whenever the plan holds an entry whose latest check found a change not yet acknowledged or found it
no longer listed. It is a slim row on the quiet `--kcp-warn-soft` fill that states the count, มี
{count} รายการที่ข้อมูลเปลี่ยนหรือไม่พบในระบบ ตรวจก่อนแชร์, with one action, ดูรายการ. The action
switches the panel to edit mode and then opens the revalidation detail sheet, whose open state the
revalidation store holds so the notice can request it. The review therefore happens in edit mode,
where the acknowledge and remove actions live, and no mutating control enters the preview DOM, as
brief section 6.4 requires. When the latest run lists no change, as after an offline check or a
partial one whose changed entries sat in a failed group, the action switches to edit only, since the
edit mode badges are then the review surface. The notice never blocks an export: the sharing actions
stay available beside it.

## Alternatives considered

A dashed border on missing blocks in the poster was rejected because the owner asked for a clean
image and the footer already carries the fact. Hiding the badges only during the capture was
rejected because it breaks the rule that preview equals export, so the user could not see what
they share. Removing all honesty was rejected because a shared image of a missing section would
then carry nothing to judge it by. Blocking the export until every change is acknowledged was
rejected as hostile at the moment of sharing.

Opening the detail sheet over preview was rejected because a review surface that later grows
acknowledge or remove actions would put a mutating control in the preview DOM. A read only copy of
the sheet for preview was rejected because it duplicates the review surface for no gain, since the
user who reviews a change usually wants to act on it.

Using the newest `lastVerifiedAt` as the data date was rejected because a single fresh entry would
then vouch for sections checked days earlier. Treating any entry without a `lastVerifiedAt` as
making the whole poster unverified was rejected because adding a section and sharing straight away
would then read as unchecked, although that section came from a live search moments before.

## Consequences

A shared image shows only the plan, and every reader sees the same neutral data date and, when it
applies, a sentence naming how many sections were not found and how many pairs clash. The footer
row gains a short text column, which takes a little poster height in the narrow portrait
templates; the export fit guard runs against every template with the data line present. Edit mode
is unchanged, so the owner still sees each badge where it can act on it. A future export format
reads the same `posterHonesty` facts rather than drawing its own marks.
