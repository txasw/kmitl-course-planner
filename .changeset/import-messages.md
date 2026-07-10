---
'kmitl-course-planner': patch
---

The plan import rejection now lists each failing field with a reason in the user's language, keeping the field path and dropping the validation library's English. A missing field, a wrong typed field, a value outside an allowed set, and an entry from another term each read as a short localized message.
