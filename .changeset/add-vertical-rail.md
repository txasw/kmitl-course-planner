---
'kmitl-course-planner': patch
---

The add control becomes a slim vertical rail on the trailing edge of a section row
rather than a button in the wrapping controls strip, so it stays within the row
bounds. The rail carries a plus icon and an aria-label and tooltip naming the
section, routes a blocked add to the feedback strip like a drag, and shows disabled
with the reason in the row body for a full, closed, or different term section rather
than disappearing.
