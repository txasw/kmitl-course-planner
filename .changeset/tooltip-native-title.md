---
'kmitl-course-planner': patch
---

Replace the panel's native title hover hints with an accessible tooltip that
dismisses on Escape, stays open while the pointer is over its content, and matches
the panel styling. It covers the grid day labels, the truncated course names and
teacher lists, the unscheduled shelf rows, and the course drag hint. Two title
attributes that never showed or duplicated visible text are dropped rather than
converted.
