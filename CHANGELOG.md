# kmitl-course-planner

## 1.0.0

### Major Changes

- 815afb4: Course Planner for KMITL 1.0.0, the first stable public release. Establishes the
  versioning baseline for the Chrome Web Store and Firefox Add-ons listings. This is an
  independent student tool for the KMITL pre-registration course search and is not
  affiliated with, sponsored by, or endorsed by KMITL.

### Minor Changes

- 97fdb08: Warn when a section's exam time overlaps another entry's. Adding an overlapping section still succeeds; the feedback strip states the clash, the affected blocks carry a warn badge, and the block details list both exam windows. Midterm windows are compared with midterm windows and final with final, and a declared lecture and practice pair never warns against itself.

### Patch Changes

- 616f602: Keep the catalog and the timetable responsive on a large search. The course card and the grid block are memoized and the props they receive are kept stable, so a filter toggle, a plan change, or a drag re-renders only what actually changed rather than every card and block. A filter that drops nothing no longer re-renders any of the hundreds of cards it leaves in place.
- 2552855: Meet WCAG AA contrast on every text and background pair. The warn and success colors are darkened so their text passes on the soft backgrounds, and interactive primary text, the buttons, tabs, and links, uses a darker shade of the brand orange that passes for normal text while the brand orange stays on the accents. A recorded ratio table and a contrast test guard the thresholds.
- 372dd42: Replace the placeholder extension icon with an original mark, a white weekly grid
  with one filled slot on the project orange, rendered from assets/icon.svg to the
  shipped 16 to 128 pixel sizes.
- 46b6696: The plan import rejection now lists each failing field with a reason in the user's language, keeping the field path and dropping the validation library's English. A missing field, a wrong typed field, a value outside an allowed set, and an entry from another term each read as a short localized message.
- 8ee02c5: A long Thai course name no longer overflows its catalog card and a long plan name no longer overflows the poster: the card and the shelf truncate with the full name on a hover, and the poster wraps the name so nothing is hidden in an export. The empty grid hint and the import error listing each gained an icon so they read as designed states.
- 8ee02c5: A render error in the panel now shows a recovery card with a reload action instead of white screening the host page. The boundary wraps the panel body, so the header keeps its close control and the host registration page behind the overlay is untouched.
- c67f1be: Rename the extension to Course Planner for KMITL (KCP) and add an independence
  notice, stating it is an independent student tool that is not affiliated with,
  sponsored by, or endorsed by the university.

This changelog is maintained by Changesets. Each released version records its
user visible changes here.
