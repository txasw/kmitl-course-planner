# kmitl-course-planner

## 1.3.0

### Minor Changes

- 801fce5: Invert the timetable block hierarchy on the grid, since the row and the block's extent already
  encode the meeting time. The subject name is now the primary anchor at the top, the place
  (building and room with a location glyph) is promoted to the second line because it is
  recoverable nowhere else on the sheet, the section stays a corner chip, and the time demotes to
  quiet metadata at the foot beside the subject id. Under the measured fit a short block drops the
  subject id, then the English name, then the time, then the section chip, then reduces the name to
  one line, then the place, with the name never dropping; the place always outlives the name's
  second line and the time is kept present as a quiet foot line rather than deleted. Long names now
  hyphenate a forced break by their language instead of splitting a word with no hyphen. The change
  applies only where position encodes time; the hover card, block popover, catalog rows, and copy
  as text keep the time prominent. Recorded in ADR-0047.
- e853d17: Add a show subject id display option to the preview toolbar, off by default. It governs the
  preview poster, every image export, and the copy as text output, so a shared timetable reads
  clean without the numeric course code unless the option is turned on, and the id stays
  recoverable from the text export when it is off. The edit grid ignores the option and always
  shows the id for cross referencing against the catalog. When on, the id is still the first
  field to yield on a short block. Recorded in ADR-0046.

### Patch Changes

- 9484f67: Block text on the preview poster and its image exports no longer clips mid glyph. Each
  field now renders whole or is dropped by measurement in a fixed priority (subject id, then
  the place line, then the section chip, then the English name, then the name reduces from two
  clamped lines to one before it drops, with the time never dropped), a long name wraps and
  ellipsizes rather than clipping in a narrow portrait column, and Thai vowels and tone marks
  keep their vertical headroom. The image capture waits for fonts to load so the export matches
  what the fit measured. Recorded in ADR-0046.

## 1.2.0

### Minor Changes

- d4e6d53: Add a hover detail card on a placed block. After a short delay the grid opens a read-only
  card with the full detail set (times, room and building, teachers, seats, exam ranges, and
  verification state), so a look no longer needs a click on the info affordance; the click and
  keyboard paths to the block detail popover stay for pinning and actions. The card reads the
  same plan snapshot the popover reads, is positioned to the side so it never sits under the
  pointer, and carries a neutral info accent so it reads apart from the danger conflict card.
  Recorded in ADR-0044.
- 528246b: Redesign the timetable block to the approved direction: the time range is the colored bold
  anchor with a small clock glyph, the subject name is the primary full weight line, the
  subject id and place read as quiet metadata at the foot, and the section is a floating chip
  in the top right corner that steps aside for the controls on hover. The soft tint fill and
  solid left bar are unchanged, and the density rule still governs a short block, so the time
  and name never clip. One component serves edit, preview, and export. Recorded in ADR-0044.
- 5b40863: Redesign the timetable block with a clear hierarchy: the time range leads, the
  subject name is the primary content clamped to two lines, and the subject id, a
  section chip, and the place read as quieter meta at the foot. The block now shows the
  building alongside the room as the place, data it already carried but never rendered.
  The soft tint fill and solid left bar are unchanged, and the quieter meta uses ink
  soft, which clears the AA text bar on every tint. Recorded in ADR-0040.
- b7b1c1e: Tint the export template day-row labels with the traditional Thai day colours as a
  faint accent. The accent appears only in the preview template render, never in edit
  mode, and the block colours stay keyed to the subject so the two colour systems never
  compete. The label text stays legible on every day tint. Recorded in ADR-0042.
- ffb584f: Add fixed export templates for the preview poster. A download is now a named size
  rather than a screenshot of the window: Share 16:9, Phone wallpaper, Tablet wallpaper,
  and Print A4, each rendered at exact pixels independent of the viewport and the device
  pixel ratio. The preview scales the selected template to fit the pane, the picked
  template persists, and the file name carries the template. The honesty rules hold at
  every size: the unscheduled shelf, the credits, and the verification badges always
  render and are never cropped. Recorded in ADR-0041.
- 3250281: Move the undo for a removal, move, or swap into a toast in the bottom feedback region,
  where the eye already is on the block that just changed, rather than a strip at the top
  of the panel that went unnoticed. The toast names what changed, offers undo, and drains
  a ten second window wired to the undo timer. Hovering or focusing the toast pauses the
  window and its drain per WCAG timing, resuming on leave. It takes priority over ordinary
  toasts, which queue behind it, and reduced motion drops the draining bar for a static
  message and button. The pull back arrow stays the icon language of the catalog remove.
- d6f06fa: Redesign the plan menu creation flow. Create becomes one prominent full width tinted button
  at the top of the menu, and rename, duplicate, and delete move to per-plan-row actions that
  appear on hover and focus of each row, icon buttons with tooltips that name the plan; delete
  keeps its confirm. Import and export JSON stay at the foot. Every per-row action is keyboard
  reachable, since the row reveals its actions on focus. Recorded in ADR-0044.
- 80eb8ef: Add a portrait phone wallpaper export template with a transposed layout: days as columns
  and time flowing down, the natural fit for a tall canvas, so it fills top to bottom
  rather than a thin horizontal band. Orientation is a template property, not a free
  toggle, so every layout stays deliberate; the existing landscape phone template stays.
  Recorded in ADR-0043 (records ruling one).
- 032580c: Add a quiet monochrome credit to the bottom-right of every export, so a shared image
  carries its origin. It rides the honesty footer position, appears in every template
  including portrait, is part of the captured composition, and is not user removable. The
  ink-soft on surface pair clears the AA text bar. Recorded in ADR-0043.
- 67d4c15: Give the export poster a smart default window. It renders the 08:00 to 18:00 working
  day, extended to the hour boundary that clears any meeting outside it, and Monday to
  Friday, revealing Sunday for a Sunday meeting and both Saturday and Sunday for a
  Saturday meeting. This supersedes fit to content for templates, so a poster reads as a
  familiar working week rather than a band trimmed to whatever hours the plan uses. The
  fit to content display option is retired. Recorded in ADR-0043.
- 65516f2: Make every export canvas read in the orientation its name implies. The phone wallpaper landscape becomes a true wide 20:9 canvas (2400x1080, from the old 1080x2340) instead of a landscape table on a portrait box, and the tablet wallpaper splits into a portrait preset (2048x2732) and a landscape preset (2732x2048). Axis orientation now follows canvas orientation as one rule the module states once: portrait canvases transpose the grid, landscape canvases keep days as rows. Share 16:9 and Print A4 are unchanged.
- 6168be2: Make the export template picker the preview itself. The dropdown and the corner size label are gone. The preview pane now renders the selected template poster centered, full height and unclipped, with the previous and next templates as a constant narrow sliver at each edge, dimmed and slightly scaled down as continuation cues. Paging: left and right arrow buttons that disable at the ends, a pointer swipe, the arrow keys, a scroll wheel or trackpad swipe (one notch one page), and a dot radiogroup below for direct jumps with the template names as tooltips and Home and End. A caption carries the localized name with the exact output pixels. Only the selected poster renders eagerly and holds the capture; the slivers render from a deferred copy so a display option change updates the visible poster at once. Paging clamps at the first and last template, and reduced motion keeps the switch instant.
- 72b54e2: Add dismissal to every toast. A compact close button dismisses it, and a pointer swipe
  tracks the toast and fades it, committing the dismissal past a threshold or springing back
  under it. Dismissing an undo toast commits the removal, the same as its expiry. Escape
  while a toast control is focused dismisses it too, and reduced motion drops the swipe
  tracking, leaving the close button.
- 72b54e2: Coalesce consecutive removals into one undo toast rather than letting a second removal
  replace the first. The folded removals show as a count, the drain window resets, and undo
  restores every folded removal in reverse order, so one toast gives full recovery. No
  stacked toasts.

### Patch Changes

- a10c9df: The add control becomes a slim vertical rail on the trailing edge of a section row
  rather than a button in the wrapping controls strip, so it stays within the row
  bounds. The rail carries a plus icon and an aria-label and tooltip naming the
  section, routes a blocked add to the feedback strip like a drag, and shows disabled
  with the reason in the row body for a full, closed, or different term section rather
  than disappearing.
- 80eb8ef: Redesign the export time axis. Hour labels center on their gridline and read as an evenly
  ticked ruler rather than clustering left-aligned at the ticks, with a stronger rule at
  midday and the window edges. The axis size scales with the template type scale. Recorded
  in ADR-0043.
- 63ead08: Simplify the placed block chrome. The hover detail card made the block's info affordance redundant, so the info control leaves the block: the block itself is now the button that opens the pinned detail popover on a click or Enter or Space, and the quiet remove control is the only chrome that remains. The hover card never shows while a popover is pinned, so the two detail surfaces never appear at once.
- c22f9a1: Collapse a status chip to its icon when its label cannot fit a narrow row, with the label
  moved into a tooltip and kept in the accessibility tree, so the full name is always
  available. Swept across the seat, kind, and state chips in the catalog rows and the
  unscheduled shelf; the block already carried a compliant dot and label.
- 658da15: The collapsed added-course summary is now one expand and collapse control: a click
  anywhere on the summary toggles its sections, with button semantics, aria-expanded,
  and the chevron as the indicator. The remove control sits beside it rather than
  nested inside, since a button cannot contain a button.
- f4333b4: Redesign the drag conflict chip. The cramped red-on-red sentence becomes a compact card on
  the surface with a danger accent, naming which section clashes on one line and when it
  clashes on the next, with a count when more conflicts follow. It anchors off the cursor and
  stays distinct from the block hover card.
- 4ea09fa: Disable the show English names display option in English, where names already render in
  English so the option has no job. It reads as not applicable, keeps its stored state, and
  carries a tooltip stating why. The switch gains a disabled state that stays focusable so
  the tooltip reaches the keyboard.
- a99cd95: Quiet the catalog add rail. Add is the secondary path and drag is primary, so the rail
  now rests as a soft tinted column with the accent icon and fills to solid only on hover
  and focus, rather than a solid orange bar that dominated the card. It claims its own
  bordered column and never overlaps the row body, which clips rather than spilling into
  the rail at any card width.
- 7cdfbb0: Keep the subject name on a short timetable block. The block clipped from the foot
  inward, but flex shrink squeezed the tall two line name out first while the shorter
  subject id survived, which inverted the emphasis order. The time and the name are now
  pinned so the foot, the subject id, the chip, and the place, is the field that yields;
  the name keeps at least one clamped line, since the id is recoverable from the text
  export and the chip carries the section.
- 1dede4c: Point a tooltip away from the content of the popover that holds its control. The plan
  menu Duplicate tooltip rendered above its icon, over the plan list it belongs to, hiding
  the options being chosen. Tooltips now take a placement preference, and the plan menu
  action buttons point their tooltips below, away from the list.
- c9a3413: The four plan actions, create, rename, duplicate, and delete, are now icon only
  buttons with a tooltip and a mandatory aria-label, which fixes the label wrapping
  in both locales. The delete confirmation is unchanged, and the import and export
  JSON entries keep their text because file actions read better with words.
- 60ffd4b: Align the export poster footer and brand the watermark. The credits summary and the credit line now share one baseline row inside the poster's equal margins, the summary flush left and the watermark flush right, rather than stacking. The watermark mark becomes the extension's own icon, built from the same icon geometry as a monochrome single-color mark in the credit text colour: the rounded tile filled, the three light squares knocked out to transparency, and the accent square kept at reduced opacity, so the brand's figure and ground survive rather than reading as detached squares.
- 80eb8ef: Give each export template its own poster type scale, so the essential text fits its
  canvas rather than clipping at some sizes. The poster and grid set one font size and the
  block and axis text are em relative, so a template scales its whole type ramp from one
  number. The density rule still governs which field yields first, so the time and name
  never clip. Recorded in ADR-0043.
- d660e64: The remove control on an added course reads as a pull back: a compact, quiet
  undo-arrow icon rather than a bordered text button, since the ten second undo makes
  a remove reversible. Its aria-label and tooltip still state the plain action, and no
  confirmation is added because the undo covers it.
- 6829a3f: Style selected text inside the panel with the brand soft wash and ink text rather
  than the browser default. It is scoped to the closed shadow root, so it never
  changes selection on the host page, and it clears the AA text contrast bar.
- cc85665: Require an exact eight digit subject id in the by subject id search. The field
  shows a live digit counter, and a submit or Enter on a shorter id shows an inline
  message and focuses the field rather than leaving a silent disabled control. The
  earlier gate accepted one to eight digits, which the registration server always
  rejected with a length error, so a short search could never return results.
- 3368501: The binary instant effect toggles, the catalog hide full, hide conflicting, and
  hide unscheduled filters and the four preview display options, are now switches
  rather than checkboxes: activated with Space or Enter, distinct in each state
  without relying on color, and with a reduced motion thumb. The day filter is set
  membership, not a switch, so it keeps its buttons.
- 214d764: Replace the panel's native title hover hints with an accessible tooltip that
  dismisses on Escape, stays open while the pointer is over its content, and matches
  the panel styling. It covers the grid day labels, the truncated course names, and
  the truncated teacher and unscheduled shelf rows. The course drag hint becomes the
  drag surface accessible name rather than a tooltip, because a tooltip on a pointer
  drag surface interferes with the drag. Two title attributes that never showed or
  duplicated visible text are dropped rather than converted.
- c2a9b78: List academic years newest first in the search year selector, since a returning
  student most often plans the newest term. The persisted last search and the route
  aware default still choose the starting year, so only the listing order changes.

## 1.1.1

### Patch Changes

- 00cb4eb: Read a section's additional meetings from the teachtime_str field. A class that
  meets more than once, such as a lecture with a second period on the same day, now
  shows every period on the grid and counts every period in conflict detection
  instead of only the first. Plans saved before this change reconcile to the fuller
  schedule on first open, which can surface a newly true conflict that was hidden
  while the extra period was missing.

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
