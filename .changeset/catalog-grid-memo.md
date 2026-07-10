---
'kmitl-course-planner': patch
---

Keep the catalog and the timetable responsive on a large search. The course card and the grid block are memoized and the props they receive are kept stable, so a filter toggle, a plan change, or a drag re-renders only what actually changed rather than every card and block. A filter that drops nothing no longer re-renders any of the hundreds of cards it leaves in place.
