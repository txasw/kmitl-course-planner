---
'kmitl-course-planner': patch
---

Fix the Go to courses action in the Summary view on desktop while the course list is open
beside the timetable. It used to move focus to the search without any visible change, so it
looked like it did nothing. It now shows the focus ring on the search tab and scrolls it into
view. The Go to search action on the empty timetable gets the same fix.
