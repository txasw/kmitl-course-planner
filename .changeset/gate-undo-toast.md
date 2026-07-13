---
'kmitl-course-planner': minor
---

Move the undo for a removal, move, or swap into a toast in the bottom feedback region,
where the eye already is on the block that just changed, rather than a strip at the top
of the panel that went unnoticed. The toast names what changed, offers undo, and drains
a ten second window wired to the undo timer. Hovering or focusing the toast pauses the
window and its drain per WCAG timing, resuming on leave. It takes priority over ordinary
toasts, which queue behind it, and reduced motion drops the draining bar for a static
message and button. The pull back arrow stays the icon language of the catalog remove.
