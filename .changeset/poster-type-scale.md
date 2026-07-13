---
'kmitl-course-planner': patch
---

Give each export template its own poster type scale, so the essential text fits its
canvas rather than clipping at some sizes. The poster and grid set one font size and the
block and axis text are em relative, so a template scales its whole type ramp from one
number. The density rule still governs which field yields first, so the time and name
never clip. Recorded in ADR-0043.
