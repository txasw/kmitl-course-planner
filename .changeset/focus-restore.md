---
'kmitl-course-planner': patch
---

Keep keyboard focus inside the planner after an add, a remove, or a closed menu. An add
from a course row or its grip now lands on the card's toggle as the card collapses, and a
remove from the card lands there too. A blocked add moves focus to the first alternative
in the feedback strip, and focus returns to the row when that notice clears. A remove
from a block, its details, its context menu, or the unscheduled shelf lands on the next
placed section in time order, or on the grid when none is left, and closing the context
menu returns focus to its block. Tab no longer wraps to a hidden control, and focus that
falls out of the panel is pulled back, so Tab and Escape keep working. The revalidation
detail list now opens as a dialog outside the status line, so a screen reader no longer
reads the whole list as a status update, and Tab stays inside it.
