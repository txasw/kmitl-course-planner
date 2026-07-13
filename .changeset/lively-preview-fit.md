---
'kmitl-course-planner': patch
---

Block text on the preview poster and its image exports no longer clips mid glyph. Each
field now renders whole or is dropped by measurement in a fixed priority (subject id, then
the place line, then the section chip, then the English name, then the name reduces from two
clamped lines to one before it drops, with the time never dropped), a long name wraps and
ellipsizes rather than clipping in a narrow portrait column, and Thai vowels and tone marks
keep their vertical headroom. The image capture waits for fonts to load so the export matches
what the fit measured. Recorded in ADR-0046.
