---
'kmitl-course-planner': patch
---

On the pre registration and registration pages, KCP no longer sends any request of its own, so it never adds load while registration is busy. Your plan shows from what is saved, and a search or a check you press still runs once, without retrying, under a short note at the top of the course list. KCP also keeps nothing from the page address beyond which page is open and the search on the course result page.
