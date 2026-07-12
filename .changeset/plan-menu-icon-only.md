---
'kmitl-course-planner': patch
---

The four plan actions, create, rename, duplicate, and delete, are now icon only
buttons with a tooltip and a mandatory aria-label, which fixes the label wrapping
in both locales. The delete confirmation is unchanged, and the import and export
JSON entries keep their text because file actions read better with words.
