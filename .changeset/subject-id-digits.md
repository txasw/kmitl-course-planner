---
'kmitl-course-planner': patch
---

Refuse non digit input in the subject id field. Keystrokes, pasted content, and IME
commits are sanitized to digits and clamped to eight, so a leading zero survives and a
letter never reaches the field.
