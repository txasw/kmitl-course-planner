---
'kmitl-course-planner': minor
---

Add dismissal to every toast. A compact close button dismisses it, and a pointer swipe
tracks the toast and fades it, committing the dismissal past a threshold or springing back
under it. Dismissing an undo toast commits the removal, the same as its expiry. Escape
while a toast control is focused dismisses it too, and reduced motion drops the swipe
tracking, leaving the close button.
