---
'kmitl-course-planner': minor
---

Redesign the plan menu creation flow. Create becomes one prominent full width tinted button
at the top of the menu, and rename, duplicate, and delete move to per-plan-row actions that
appear on hover and focus of each row, icon buttons with tooltips that name the plan; delete
keeps its confirm. Import and export JSON stay at the foot. Every per-row action is keyboard
reachable, since the row reveals its actions on focus. Recorded in ADR-0044.
