---
'kmitl-course-planner': patch
---

Simplify the placed block chrome. The hover detail card made the block's info affordance redundant, so the info control leaves the block: the block itself is now the button that opens the pinned detail popover on a click or Enter or Space, and the quiet remove control is the only chrome that remains. The hover card never shows while a popover is pinned, so the two detail surfaces never appear at once.
