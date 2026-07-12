---
'kmitl-course-planner': patch
---

Replace the panel's native title hover hints with an accessible tooltip that
dismisses on Escape, stays open while the pointer is over its content, and matches
the panel styling. It covers the grid day labels, the truncated course names, and
the truncated teacher and unscheduled shelf rows. The course drag hint becomes the
drag surface accessible name rather than a tooltip, because a tooltip on a pointer
drag surface interferes with the drag. Two title attributes that never showed or
duplicated visible text are dropped rather than converted.
