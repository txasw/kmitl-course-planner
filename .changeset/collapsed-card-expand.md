---
'kmitl-course-planner': patch
---

The collapsed added-course summary is now one expand and collapse control: a click
anywhere on the summary toggles its sections, with button semantics, aria-expanded,
and the chevron as the indicator. The remove control sits beside it rather than
nested inside, since a button cannot contain a button.
