---
'kmitl-course-planner': patch
---

The remove control on an added course reads as a pull back: a compact, quiet
undo-arrow icon rather than a bordered text button, since the ten second undo makes
a remove reversible. Its aria-label and tooltip still state the plain action, and no
confirmation is added because the undo covers it.
