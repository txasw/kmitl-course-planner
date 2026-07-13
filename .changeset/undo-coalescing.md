---
'kmitl-course-planner': minor
---

Coalesce consecutive removals into one undo toast rather than letting a second removal
replace the first. The folded removals show as a count, the drain window resets, and undo
restores every folded removal in reverse order, so one toast gives full recovery. No
stacked toasts.
