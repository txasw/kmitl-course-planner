---
'kmitl-course-planner': patch
---

Keep the panel in place when the catalog scrolls a course into view. With several course cards
open, a scroll into view that the results list could not finish on its own moved the whole panel
up, the column header and the timetable with it, and nothing scrolled it back. The list now holds
all of its own content, so only the list scrolls.
