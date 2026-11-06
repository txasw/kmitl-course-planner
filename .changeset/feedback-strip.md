---
'kmitl-course-planner': patch
---

Keep the feedback strip readable and reachable at every width. Its notices now wait while
the pointer rests on the strip or focus is inside it and resume with the time left, and
each one ends with a close control, ปิดข้อความ, Dismiss message. Below 1024 px the strip
floats at the foot of the open course sheet, or of the timetable while the sheet is
closed, above the dimmed backdrop and above a toast, so its alternative sections can be
tapped and a blocked add moves focus to the first of them; a cross term add moves focus
to its switch action too. On wider screens it stays at the top of the timetable. Show in
the list now opens the sheet or brings back the hidden course column, scrolls the course
into view and moves focus to it, and when the current results no longer list the course,
the strip offers ค้นหารายวิชานี้, Search for this course, which runs a search by its
subject code in the plan's term.
