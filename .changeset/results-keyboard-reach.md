---
'kmitl-course-planner': patch
---

Keep the catalog results reachable by keyboard at every layout tier. The results are now
a region named ผลการค้นหา, Search results, and while they hold no control, before a
search, while one loads, or after a search that found nothing, the region takes focus
itself so the arrow keys can scroll a hint that runs past a short column. Below 1024 px
the list leaves room at its foot for the floating feedback strip, so the last add button
in a long list scrolls clear of the strip and the nav when it takes focus instead of
staying under them.
