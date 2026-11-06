# 59. Drop zone vocabulary

Status: Accepted
Date: 2026-11-06

Amends ADR-0021 (the placement feedback model) and ADR-0025 (the move, swap and remove targets and
the explicit drop target priority recorded with them). Names the dotted preview of ADR-0057 as the
one member of the vocabulary that is never a target.

## Context

A drag shows where it can land only in parts. A valid section drag paints its footprint ghosts,
but the region that commits, the whole planner panel, has no edge on screen, so a student cannot
tell where releasing is safe until the drop has happened. Move candidates during a block drag carry
only a section code, which reads the same as an add slot. A swap target is a dashed orange box with
a repeat icon and the incoming code, so its meaning depends on knowing the icon. The dragged block
dims in place, but releasing on it shows the missed drop hint, as if the student had done something
wrong by changing their mind. Nothing tells a screen reader user which targets a drag offers.

On the Medium tier the catalog is a modal sheet over the grid with a scrim, so a section or a
course dragged out of it travels over a dimmed grid that the sheet half covers.

## Decision

Every drop target shows its role from the moment the drag activates, not from hover, and each role
has a border style or an icon as well as a colour.

- Place, in the success tokens. During a valid section drag a commit outline draws a 2 px dashed
  success border inset 4 px from the edge of the planner drop zone, over the footprint ghosts. It
  turns solid with a soft success ring while the pointer is over the drop zone. It is one element
  and carries no text, so the silence rule of ADR-0021 holds: a drag that fits still says nothing
  visible. Valid candidate slots of a course drag keep their success fill, solid border and section
  code. During a block drag the valid candidates are labelled ย้ายไปกลุ่ม {section}, Move to section
  {section}, so a move reads apart from an add.
- Remove, in the danger tokens, during block drags only, as the remove zone already does.
- Swap, in the KMITL orange. A swap target has a solid 2 px primary border, the ArrowLeftRight
  icon and the label สลับเป็นกลุ่ม {section}, Swap for section {section}, and fills primary soft
  while the pointer is over it.
- Blocked, in danger soft with the hatch and the not allowed cursor, with no outline, as ADR-0021
  records.
- The lifted origin. During a block drag each meeting of the dragged section and its pair keeps
  its block at 40 percent opacity under a 1 px dashed ink soft border. The origin is a drop target
  of its own, and a drop on it ends the drag silently: no change, no hint.

Solid and dashed borders belong to targets. The dotted 2 px border of the course hover preview and
the dotted row hover ghost of ADR-0057 is the non target member of the vocabulary: no drop target
uses a dotted border, so the dashed lifted origin never reads as a preview.

The explicit drop target priority keeps its order and gains the origin: the remove zone, then a
swap target, then a candidate slot, then the lifted origin, then the planner panel. A candidate of
the same subject that shares a cell with the origin wins, because it is the raised, labelled
choice the student is pointing at.

At drag start the feedback strip's live region says, in one sentence, which targets the drag
offers: the timetable for a valid section drag, the conflicting blocks to swap for a blocked one,
the highlighted slots for a course drag, and the remove zone, the highlighted slots and the origin
for a block drag, or only the remove zone and the origin when the subject is not in the catalog.
dnd-kit's own announcements are turned off, since they name internal ids and would read a second
sentence for an outcome the strip owns under ADR-0048. The catalog edge rail is not a target and
ignores the pointer during a drag, so the sentence never names it.

On the Medium tier an open sheet yields during a section or course drag: it slides to a 24 px peek
at the left edge and the scrim fades and stops taking the pointer, so the grid is the live target.
When the drag ends the sheet returns. It stays mounted the whole time, so its scroll offset is the
one the student left.

## Alternatives considered

Outlining only the grid rather than the drop zone was rejected because a drop on the shelf or the
footer below the grid also commits, and the outline must show the region that does. A visible
"drop here" caption in the outline was rejected because it breaks the silence rule and covers the
first hour columns. Highlighting targets only under the pointer, the behaviour before this record,
was rejected because the student has to sweep the grid to discover them.

Keeping the swap target dashed was rejected because dashed now marks the latent commit outline and
the origin; a swap is a committed exchange and reads solid. Making a drop on the origin show the
missed drop hint was rejected because returning a block to its place is a deliberate cancel, not a
mistake.

Closing the Medium sheet at drag start was rejected because the student would lose their place in
the list and reopen it after every drag. Leaving the sheet over the grid was rejected because it
hides the first hours and the scrim dims the very target the drag is aimed at.

## Consequences

A drag reads the same way everywhere: success means place, danger means remove or blocked, orange
means swap, dashed ink soft means the block's own place, and dotted means a preview that takes no
drop. The commit outline is a single element drawn only during a valid section drag, so the paint
cost of a drag does not grow with the plan. A block drag can now be called off by putting the
block back. A Medium tier drag keeps the catalog one edge away and its list where it was.

## Amendment, 2026-11-06: the catalog remove zone

The remove target was a small floating pill at the bottom centre of the panel. It was easy to
miss, and it could sit over a block in the last row of the grid. It is retired. The remove zone
now takes one of two forms, and exactly one is mounted for each block drag.

- The column form, while the docked catalog column is shown. The column itself is the target:
  the block came from the list, so dragging it back there reads as remove. The column content
  stays mounted and dims to 30 percent, so the student keeps their place, under an overlay with
  the `--kcp-danger-zone` fill, a 2 px dashed danger border inset 8 px, and a centred label with
  a 24 px trash icon, วางที่นี่เพื่อนำออกจากตาราง, Drop here to remove from the plan, in danger
  text on the surface. While the block is over it, the fill turns `--kcp-danger-zone-over`, the
  border turns solid, and the label turns solid danger with white text, ปล่อยเพื่อนำออก, Release
  to remove. The icon keeps its size, so nothing reflows. The overlay covers the whole column,
  the search summary bar included, takes no pointer events, and multiplies its fill onto the
  dimmed content, so the column white reads as the token and the list still shows through.
- The bar form, on the tiers below the dock and while the docked column is hidden. A 64 px band
  across the panel bottom, over the summary bar and padded by the bottom safe area inset, with
  the same fills, borders and labels.

Either drop removes the section and its pair as one transaction, with the ten second undo.
Every remove target id carries the `kcp-remove-` prefix, and the explicit priority ranks any id
with that prefix first, above a swap target and a candidate.

The zone couples to the column's visibility, recorded in ADR-0048. The form is chosen at drag
start from the tier and the docked choice, which cannot change during a drag. A hidden column
mounts no zone, so a block dropped over its former place, or over the edge rail, falls through
to the planner panel and commits nothing, and the bar is the target instead. Every drag first
finishes a running column slide, so the zone is measured where the column settles, and while a
block is dragged nothing inside the column auto scrolls under the pointer.

Keeping the pill alongside the column was rejected because two remove targets on screen dilute
the vocabulary, and the pill could cover a block. Making all space outside the grid a remove
zone was rejected because a drop on the header or the toolbar should cancel, not destroy.
Painting the fill as an opaque layer over the column was rejected because it would hide the list
the student is returning the block to.
