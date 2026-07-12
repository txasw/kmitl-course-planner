---
'kmitl-course-planner': patch
---

Require an exact eight digit subject id in the by subject id search. The field
shows a live digit counter, and a submit or Enter on a shorter id shows an inline
message and focuses the field rather than leaving a silent disabled control. The
earlier gate accepted one to eight digits, which the registration server always
rejected with a length error, so a short search could never return results.
