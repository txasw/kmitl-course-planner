---
'kmitl-course-planner': patch
---

Disable the show English names display option in English, where names already render in
English so the option has no job. It reads as not applicable, keeps its stored state, and
carries a tooltip stating why. The switch gains a disabled state that stays focusable so
the tooltip reaches the keyboard.
