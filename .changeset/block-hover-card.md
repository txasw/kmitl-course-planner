---
'kmitl-course-planner': minor
---

Add a hover detail card on a placed block. After a short delay the grid opens a read-only
card with the full detail set (times, room and building, teachers, seats, exam ranges, and
verification state), so a look no longer needs a click on the info affordance; the click and
keyboard paths to the block detail popover stay for pinning and actions. The card reads the
same plan snapshot the popover reads, is positioned to the side so it never sits under the
pointer, and carries a neutral info accent so it reads apart from the danger conflict card.
Recorded in ADR-0044.
