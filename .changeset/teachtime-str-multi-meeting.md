---
'kmitl-course-planner': patch
---

Read a section's additional meetings from the teachtime_str field. A class that
meets more than once, such as a lecture with a second period on the same day, now
shows every period on the grid and counts every period in conflict detection
instead of only the first. Plans saved before this change reconcile to the fuller
schedule on first open, which can surface a newly true conflict that was hidden
while the extra period was missing.
