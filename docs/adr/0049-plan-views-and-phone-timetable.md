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
and the toggle is hidden. The day view shipped first, and the week toggle followed once the
portrait grid carried its editable layers: candidates, swap targets, the lifted origin and the
ghosts place by the same track math, and stacked candidates fan down the time axis by the full
step but across a day column by a narrow one, so a seven column phone week keeps each label
legible. The week takes the edit frame's smart days, which already cover the placed meetings and
every catalog meeting a course drag or block move can paint, so a drag never reflows it.

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

## Amendment, 2026-11-20: one chip row and the plan status row

Owner feedback asked for a prominent suggest entry and for icons with less text at the top of
the phone timetable. Two parts of this record change; the rest stands.

The day or week toggle joins the day chips. A narrow timetable heads itself with one radio group,
still named วันที่แสดง (Day shown): a week chip labelled สัปดาห์ (Week) with a calendar glyph leads
the row, and a chip per teaching day follows as before. A day chip shows the day view and the week
chip shows the portrait week, so the student moves between a day and the week in one tap, and the
row stays in place for both. The day view is still the default and the choice is still the
optional `timetableView` preference. The arrow keys walk the whole row, week chip included, and
wrap; Home and End reach its ends; a swipe on the day view steps the days only and stops at either
end, so it never lands on the week. The chosen chip reads without colour: it takes the heavier
weight, an inset outline, and an underline bar that sits in the flow under the label rather than
over it. Day chips share the row width and the week chip keeps the width its label needs; no
chip shrinks below its content, and the row wraps before it would clip, which only a plan with
both weekend days at 360 px could approach. Day chips keep the 44 px touch height but drop the
44 px width that a coarse pointer gave the old chips, holding the 24 px minimum of WCAG 2.5.8
instead. With the week chip and all seven days at 360 px a day chip is about 35 px wide, and a
44 px floor there would push the row onto a second line, which costs the timetable more height
than the narrower target costs in reach. The separate quiet segmented toggle is removed.

The stats bar becomes the plan status row. It keeps its place at the foot of the plan region
under every view, which on a phone is the thumb zone above the bottom nav, and keeps its
accessible name สรุปตาราง (Plan summary). Its facts lead with icons: credits, subjects, the clash
state, the unscheduled count, and the verification status. From 640 px up it still lists the
load per day and the free weekdays. On a phone it drops those two, since the day chip dots
already mark the class days and the summary view carries the load, and the no clash state shows
as a shield check glyph with its words kept for assistive technology; a clash stays a worded
danger button. The shield keeps that glyph apart from the plain check of a verified plan, which
sits beside it in the same green, so the bare icon never reads as a second verified mark. The suggest action of ADR-0054 ends the row in a primary soft style, its checklist glyph
and the short label แนะนำตาราง (Suggest), outside the wrapping facts so it holds the right edge.
It follows the same rule as the catalog entry: present only for a by_class result of the plan's
term, absent otherwise. With such a result and an empty plan the row holds the action alone.
Desktop and tablet use the same row, so there is one status surface at every tier rather than a
stats bar plus a second strip.

A floating suggest button over the timetable was rejected because it would sit over blocks and
text. Moving the facts into a tappable summary button, as the mockup drew, was left for a later
change, since the summary view is already one nav item away.

## Amendment, 2026-11-20: the free day notice is one line with one action

Brief 8.2 gives every empty state an icon, one sentence, and one action, and the 1.5.0 release
review found the free day notice short of both: its body was the phrase วันว่าง (Free day) and it
offered nothing to press. The agreed mockup draws the free day as one quiet line at the top edge
of the day slot rather than a centered card, so the notice is now that line: a small neutral
glyph, วันว่าง ไม่มีคาบเรียน (Free day, no classes.), and the text button ดูทั้งสัปดาห์ (Show the
week), which selects the week chip and moves focus to it, since the day view and its notice leave
with the switch. The line has no frame, no icon disc, and no wash over the lanes, only a surface
band behind its own text so no quarter rule crosses it. It does not repeat the day name, which the
chip row and the grid label already carry, and it is not pinned, since a free day opens scrolled
to the top. The chips stay the path to any other day. A centered card titled with the day name,
the shape the notice had, was rejected because it floats over the lanes as an object the mockup
does not draw. The same review brought the other panel empty states to the shared component with
one action each: the idle catalog goes to the search, an empty result and a filter that matches
nothing reopen the search or clear the filters, the empty selected courses list goes to the
courses, and an empty suggestion either ticks every subject or closes the dialog. Those actions
are neutral bordered buttons, and the actions over the timetable are text buttons, as the mockup
draws them; only the search error card and the panel recovery card keep the filled orange they
already had. The preview poster's empty notice keeps no action, because a shared picture carries
no control.

## Amendment, 2026-11-21: every opening starts on the day, today first

A conformance review found the phone timetable opening on the portrait week. The day view was
still the default, but the week chip was remembered as the optional `timetableView` preference,
so one tap on the week kept every later opening on the week, against the agreed mockup and this
record, which make the day view the phone default. The layout is no longer a preference. Every
opening of the panel starts on the day view, as every opening starts in edit (ADR-0022
amendment), and a week the student picks holds until the panel closes, one tap away on the week
chip throughout. A preferences blob that still carries the field loads whole with it stripped,
as a stored view mode is, so no schema version bump is due.

The day it opens on is today when today has a class, so a student checking the day's classes
lands on them; otherwise it is the first weekday with a class, as before, and a plan with no
scheduled class opens on Monday. A free today was rejected as the opening day, since a planner
opened before the term starts would land on an empty column. The day is read once as the
timetable mounts, so the view never moves under the student at midnight.

## Amendment, 2026-11-21: the no clash state is worded on a phone

The phone status row showed the no clash state as a bare shield check, with its words only in
assistive technology text and a title tooltip. A touch user never sees a tooltip, so the green
shield carried no readable meaning there. On a phone the shield now carries a short visible word,
ไม่ชน (No clash), while assistive technology keeps the full words ไม่มีรายการชนกัน (No
conflicts) and the title is removed. From 640 px up the row keeps the full words. The row still
wraps its facts rather than cutting them, so the extra word moves to the second line on the
narrowest phones instead of clipping. Hiding the indicator on phones and showing only the clash
button was rejected, because the student then cannot tell a plan with no clash from a row that
has not loaded. The suggest action at the end of the row is now a filled primary button with its
own glyph (ADR-0054 amendment of the same date), replacing the primary soft style and the
checklist glyph named above.

## Amendment, 2026-11-21: tab icons and a quiet count

## Amendment, 2026-11-21: tab icons, a quiet count and touch height

The redesign asks for icons and less text, and the conformance review found the Medium and Wide
tabs text only, with the subject count in brackets, "วิชาที่เลือก (5)", and a row that stayed 40 px
(36 px under the height rule) on a touch tablet.

Each tab now leads with the icon its bottom nav item carries on Compact: a calendar for ตารางเรียน,
a checklist for วิชาที่เลือก and a clipboard for สรุป. One `PLAN_VIEW_ICON` map serves both the
tabs and the nav, so a view keeps one glyph at every width. The label no longer holds the count.
The selected tab follows its label with the count as a quiet number in the muted ink, tabular and
in the regular weight, with no brackets, as the mockup draws it, and the accessible name joins the
label and the count, "วิชาที่เลือก 5", with the exam clash wording after it where it applies. The
count shows at zero too, unlike the nav, because the tab is always the label and the number side
by side. Under a coarse pointer the row is 44 px at any height, the touch target, and the 36 px
step under `max-height: 800px` now applies to a fine pointer only, so the two height rules never
compete. The responsive spec checks the tabs as touch targets on the tablet project.
