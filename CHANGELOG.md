# kmitl-course-planner

## 1.1.0

### Minor Changes

- 4183fc6: Collapse a catalog card once one of its sections is in the plan. The card de-emphasizes to
  a summary of the subject id, name, and credits with a remove and an expand affordance;
  expanding reveals the sections read only for reference, since changing section happens by
  dragging the block on the grid.
- cc4aedd: Add a right click context menu on a placed block in edit mode with two shortcuts, details
  and remove. It replaces the browser menu only on a block, closes on Escape or a click away,
  and stays within the panel. Every keyboard and popover path is unchanged.
- 24008fc: Tighten the catalog card. The section teachers truncate to one line with the full list on
  a hover title, and a remark opens from a compact info affordance rather than crowding the
  row.
- 2d12d43: Replace the last native select in the panel, the credit filter, with the accessible
  combobox in a select only mode, and portal the combobox popup so it positions correctly
  inside the slide over catalog drawer.
- 55880c4: Exam overlap is now a hard block, not a warning. Adding a section whose midterm or final
  overlaps one already in the plan is blocked through the same path as a time conflict, and
  the blocked reason names the exam type and its date range in the Buddhist year both locales
  show. An exam overlap discovered on an existing plan through revalidation or import reads
  danger on the block and is never removed automatically.
- 0201323: Redesign the catalog filter bar. One always visible search field sits beside a filter
  button that carries an active count badge and opens a popover with the day, credit, and
  hide facets; the active facets render as removable chips under the field with a clear all.
- eb03d20: Give the grid blocks a lighter treatment: a soft tint of the subject color under ink text
  with the saturated color as a left bar, replacing the solid fill with white text. The ten
  color palette keeps WCAG AA on the new ink on tint and bar pairs, and the export and
  preview render identically to edit.
- 4183fc6: Make the whole catalog surface a drag source, not only the grip. A section row drags from
  anywhere on its body and a course card drags from its header, the city builder grab feel,
  while a click on an add or remove button still clicks. The grip stays as the visual hint
  and the keyboard commit anchor.

### Patch Changes

- 6633d57: Keep the keyboard focus ring from being clipped. Standardize the focus indicator on an
  inset orange ring for light controls, which paints inside the control so a scrolling rail
  or the catalog drawer can no longer cut it off, and keep an offset outline on the solid
  orange buttons where an inset ring would fail contrast.
- 0f6299d: Refuse non digit input in the subject id field. Keystrokes, pasted content, and IME
  commits are sanitized to digits and clamped to eight, so a leading zero survives and a
  letter never reaches the field.
- 607c151: Use the canonical Thai section term กลุ่มเรียน in the hide full and hide time conflicts
  filter labels, replacing the non canonical ตอน.

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
