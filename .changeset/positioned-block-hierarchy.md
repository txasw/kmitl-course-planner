---
'kmitl-course-planner': minor
---

Invert the timetable block hierarchy on the grid, since the row and the block's extent already
encode the meeting time. The subject name is now the primary anchor at the top, the place
(building and room with a location glyph) is promoted to the second line because it is
recoverable nowhere else on the sheet, the section stays a corner chip, and the time demotes to
quiet metadata at the foot beside the subject id. Under the measured fit a short block drops the
subject id, then the English name, then the time, then the section chip, then reduces the name to
one line, then the place, with the name never dropping; the place always outlives the name's
second line and the time is kept present as a quiet foot line rather than deleted. Long names now
hyphenate a forced break by their language instead of splitting a word with no hyphen. The change
applies only where position encodes time; the hover card, block popover, catalog rows, and copy
as text keep the time prominent. Recorded in ADR-0047.
