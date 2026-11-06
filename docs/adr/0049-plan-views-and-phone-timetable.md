# 49. Plan views and the phone timetable

Status: Accepted
Date: 2026-11-05

Amends brief section 6.4 (the weekly grid as the only plan surface) and ADR-0043 (portrait
orientation documented as an export only layout). Builds on the tiers in ADR-0048.

## Context

Section 6.4 makes the weekly grid the one surface that shows a plan. That holds on a wide screen,
but it leaves three gaps. A touch, keyboard or screen reader user has no way to manage the plan
except through the grid blocks and their popover, and the popover lacks times, rooms, seats,
credits and exam dates. The approved exam schedule, weekly workload and free period features
need a place larger than a popover. And on a phone the landscape grid either scrolls sideways or
shrinks its blocks below a readable size; the 390 px screenshots show both.

The owner's mockup names three plan views: ตารางเรียน (Timetable), วิชาที่เลือก (Selected
courses) and สรุป (Summary), and asks for a daily timetable on phones. ADR-0043 already provides a
portrait orientation, days as columns and time flowing down, but documents it as read only and
limited to export templates, because the drag machinery never ran in portrait.

## Decision

Three plan views at every tier. ตารางเรียน is the grid. วิชาที่เลือก, with the placed subject
count in its label, lists one card per placed subject built on the shared section detail list, with
change section, remove, and copy registration list actions; it is the management path that needs
no drag. The label counts subjects rather than plan entries so it matches the cards: a lecture and
practice pair is two entries but one card.
สรุป opens on the plan's exam schedule and then shows weekly workload, free periods and credits;
the always visible stats bar stays the at a glance line, and สรุป is its detail view rather than a
duplicate. An exam clash marks the สรุป tab or nav item with a danger dot so the exam schedule
stays discoverable. The selected view is session state and is not persisted.

On Medium and Wide the views are an underline tablist above the grid region, 40 px tall and 36 px
under a `max-height: 800px` media rule so 720 px laptops keep grid height. On Compact they join the
catalog pane in a bottom nav of four items: รายวิชา (Courses, with the result count), ตารางเรียน,
ที่เลือก (Selected, with the subject count) and สรุป. Each item is at least 56 px tall with safe
area padding below it, and the count is part of each accessible name. The default Compact pane is
ตารางเรียน when the plan has entries and รายวิชา otherwise, and an add never switches panes. Preview
shows no tab row and no nav; it stays the poster composition from section 6.4.

Day by default on narrow timetables. When the grid scroller, measured by a resize observer rather
than the viewport, is narrower than 640 px, the timetable shows one day at a time. A radio group
named วันที่แสดง (Day shown) holds day chips for จ อ พ พฤ ศ, adding ส and อา only when a
meeting needs them, so the week shape stays visible: each chip carries a neutral dot for a class
day and a danger dot for a conflict. Below the chips, one time column uses the smart window from
ADR-0043 with full width blocks. The initial day is the first weekday with a class. A horizontal
swipe also changes the day, activating only past a short threshold with no long press pending, and
the chips stay the accessible path. A day with no classes reads วันว่าง (Free day) with the day
name. A quiet รายวัน or รายสัปดาห์ (Day or Week) toggle, remembered in an optional preference field
with no schema version bump, switches to the week, which renders the weekly grid in portrait
using the smart visible days and the measured fit. At 640 px and up only the landscape week shows
and the toggle is hidden. The day view ships first, and the week toggle arrives when the portrait
grid carries its editable layers.

This amends ADR-0043: portrait becomes an on screen orientation of the edit grid as well as an
export template property. Template orientation still governs every export, and the pure minute to
index math in `grid.ts` stays shared and unchanged.

Block details as a bottom sheet. Block details render one shared section detail list in every
container. On a fine pointer at 640 px and up they open in the anchored popover. Below 640 px or on
a coarse pointer they open in a bottom sheet whose sticky footer carries the acknowledge action
when the entry changed and the remove action. Focus moves to the sheet heading on open and returns
to the block on close. Preview keeps the section 6.4 rule that its blocks accept no pointer
interaction, so no detail surface, popover, sheet or hover card, opens in preview.

## Alternatives considered

Tabs of timetable, exam schedule and selected courses, with the summary in a stats popover, were
rejected because the owner adopted timetable, selected courses and summary, and because workload
and free periods need more room than a popover offers on a phone; placing the exam schedule first
in สรุป with a danger dot keeps it one action away. A search pane in the bottom nav was rejected
because search is a state of the catalog column under ADR-0048, not a destination. Five nav items
were rejected as too dense at 360 px.

A week default on phones was rejected in favour of the owner's stated daily preference; the chip
dots answer the concern that planning needs the shape of the week. A sideways scrolling landscape
grid on phones was rejected because it hides most of the day and the day labels. A today highlight
and calendar dates were rejected because a plan is a repeating weekly template.

A read only detail surface in preview was rejected because section 6.4 states that preview blocks
accept no pointer interaction, and ADR-0022 keeps preview free of anything a student could act on
by accident. A full detail copy inside the hover card was rejected because the two surfaces have
already drifted apart; one shared detail list removes the drift.

## Consequences

Students learn the same three views at every width, and the selected view gives touch, keyboard and
screen reader users a complete management path that does not depend on drag. The grid is no
longer the only plan surface, so features that summarize a plan get a home without crowding the
grid. On a phone the timetable reads one full width day at a time while the chips keep the week
visible. Portrait now runs on screen, so its block placement and fit get test coverage in edit
rather than only in export. The tab row costs 36 to 40 px of height on Medium and Wide, the
scarcer axis on 720 and 768 px laptops, which is why it tightens under that height rule.
