---
'kmitl-course-planner': patch
---

A course whose saved search has no readable semester is no longer added to a first semester
plan. Such an entry used to be accepted and then fail the next time the plan loaded.
