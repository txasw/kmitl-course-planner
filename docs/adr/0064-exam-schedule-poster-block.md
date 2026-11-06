# 64. Exam schedule poster block

Status: Accepted
Date: 2026-11-06

Amends ADR-0043 (export geometry). The exam schedule model it reads is `buildExamSchedule` in
`lib/planner/examSchedule.ts`.

## Context

Students share their exam timetable as often as their class timetable; the host menu itself is
named ตารางเรียน-สอบ. The plan already holds every midterm and final window, and the planner
arranges them into a dated schedule, but neither the poster nor the copy as text output carried
them, so a student who wanted to send both had to type the exam dates by hand.

The poster is a fixed canvas. ADR-0043 fixes its geometry per template and ADR-0046 fits each
block to its box by measurement, so anything added below the grid takes height from every day
row. The Share 16:9 canvas is 540 CSS pixels tall, and a plan of eight subjects can carry sixteen
exam windows, so an unbounded list would starve the grid, which is the hero of the poster.

## Decision

A new display option, `showExams`, adds the plan's exam schedule to the poster and to the copy as
text output. It is off by default, so a poster stays a clean class timetable unless the student
asks for more, and it is a defaulted schema field, so a preferences blob written before it
existed still loads and reads the option off, with no schema version bump. The display options
popover lists it as แสดงตารางสอบ.

On the poster, `PosterExamBlock` renders below the unscheduled shelf and above the footer row.
It lists one row per subject and exam window, midterm windows before final windows in date
order, then one row per subject that announces no dated exam, labelled จัดสอบเอง. A row reads
the exam kind, the date and time in the Buddhist year form the rest of the app shows, and the
subject, which honours the show subject id, show section, and show English names options exactly
as the shelf and the text export do. The block is ink only: labels in ink soft, subjects in ink,
one hairline border, and no danger or warn colour and no clash mark, because ADR-0055 keeps
editing signals out of shared images and the footer data line already counts an exam clash as a
conflicting pair. Its text is sized in em, so it scales with each template's `posterFontPx` like
the data line and the watermark.

The block yields to the grid. Its height is capped at one quarter of the template's layout
height, and its rows flow across columns at least 16em wide, so a landscape canvas lists several
windows per line. When the rows do not fit inside the cap, the block drops whole rows from the
end of the list, the arranged by instructor rows first and then the latest finals, and states
the dropped count on a closing line, อีก {count} รายการ, so a row is either complete or absent
and never clipped. The drop is a measurement in the same style as ADR-0046: it resets to the full
list when the rows, the template, or the fonts change, and when the block's width resizes, and
otherwise demotes one row at a time until the content fits, all before paint, so the capture
reads the settled list. Only a width change resets it: the block's height follows its rows, so
dropping a row shrinks the box, and a reset on that resize would refill the list and loop.

Copy as text appends a block labelled ตารางสอบ after the unscheduled block and before the app
line, with one line per row in the same order and wording, and no cap, since a chat message has
no canvas to fit. When the plan has no subjects the block is absent from both outputs.

## Alternatives considered

A separate exam poster template was rejected because it doubles every canvas and the student
then shares two images where one carries both. Turning the block on by default was rejected
because most shares are the class timetable alone and the block takes grid height. Marking
clashing exams in danger was rejected for the reason ADR-0055 removed the block badges: the
reader cannot act on it, and the footer states the clash as text. Letting the block grow without
a cap was rejected because on Share 16:9 a full exam list would shrink every day row until the
block fit dropped the place and section from the timetable itself. Shrinking the exam text to fit
every row was rejected because it falls below a legible size on the small canvases and breaks the
one type scale per template rule of ADR-0043.

## Consequences

A student can share one image, or one message, that carries both the class timetable and the
exam dates. With the option off the poster is unchanged pixel for pixel, so existing exports and
the measured block fit are unaffected. With the option on the grid loses at most a quarter of its
height, and a plan with many exams lists the earliest ones on the poster and points to the rest
by count, while the text export always carries every row. The export fit guard runs every preset
with the option on and off, so a block that clips, or a grid block that clips under the reduced
height, fails the suite.
