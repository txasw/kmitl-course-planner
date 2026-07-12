# Manual QA checklist: planner

Run this against the built debug extension on the live host before shipping a
change that touches the planner. Load the unpacked build (`pnpm build:debug -b
chrome` then load `.output/chrome-mv3-debug`; for Firefox `pnpm build:debug -b
firefox` then load `.output/firefox-mv3-debug/manifest.json` from about:debugging)
and open `https://regis.reg.kmitl.ac.th/#/teach_table_selector`. Do the whole list
in both Chrome and Firefox.

The pointer drag is called out first because it is the path automated coverage
reached late and a regression here is invisible to a reader who only clicks the add
button. Never skip it.

- [ ] Pointer drag, valid: drag a section's grip handle onto the grid. A compact
      grab card with the subject id, section, and lecture or practice badge follows
      the pointer, green footprint ghosts show the target cells, and the drop
      commits a block with the settle animation.
- [ ] Pointer drag, blocked: drag a section that clashes with a placed one. The
      footprints turn danger soft and hatched, each blocking block pulses twice, the
      cursor shows not allowed, and a reason chip follows the pointer. The drop
      commits nothing.
- [ ] Rejected drop fallback: after a blocked drop, the feedback strip states the
      reason and offers up to two alternative sections that fit; tapping one adds it
      and clears the strip. When none fit, the reveal action filters the catalog to
      the subject.
- [ ] Blocked add via the button: pressing add on a time conflicting section routes
      to the same feedback strip with the same alternatives rather than doing
      nothing.
- [ ] Keyboard grip: tab to a grip handle. Focus shows the low emphasis hover
      preview. Enter or Space commits the section, or routes to the blocked feedback
      for a conflicting one, and the outcome is announced.
- [ ] Add and remove buttons: add an open section, then remove it. Removal confirms
      in the strip with a ten second undo that restores it. A paired section adds and
      removes as one unit.
- [ ] Unscheduled course: search the all curricula path, add an online course with
      no meeting. It lands on the unscheduled shelf, its credits count in the footer,
      and it appears on the preview poster.
- [ ] Unscheduled filter: toggle the hide unscheduled filter in the catalog and
      confirm the no meeting sections drop out of the list.
- [ ] Course drag: drag a course card. Every section shows as a labeled footprint,
      valid ones as droppable slots and blocked, full, and closed ones as hatched
      with their reason. Hovering a candidate highlights its whole section group.
      Dropping on a valid slot commits that section and its pair.
- [ ] Whole surface drag: grab a section row on its body, not only the grip, and drag it
      onto the grid; it places. Grab a course card header and drag; every section shows as a
      candidate. A click on a row's add or remove button still clicks rather than dragging.
- [ ] Block context menu: right click a placed block in edit mode. A small menu opens with
      details and remove. Details opens the block popover; remove takes the section off the
      grid. Escape and a click away close only the menu. In preview the browser menu shows.
- [ ] Added course collapse: add a section, then find its card in the catalog. It collapses
      to a dim summary with the subject id, name, credits, a remove, and an expand. Expand
      shows the sections read only with the hint that section changes happen by dragging the
      block. Remove from the collapsed header takes the section off the grid.
- [ ] Overlay tracking: while dragging a section grip, the grab card follows the
      pointer within a few pixels rather than floating above it.
- [ ] Block drag to remove: grab a placed block. The remove zone appears at the panel
      edge. Drop the block on it. The section and its pair leave with a strip
      confirmation and a ten second undo that restores them.
- [ ] Block drag to move: grab a placed block of a subject that has another section in
      the current results. The grid paints that section as a candidate slot. Drop on it.
      The section moves atomically and a single undo restores the original placement.
- [ ] Swap on a conflict: start a drag that clashes with a placed section. Each blocking
      block shows an orange swap target naming the incoming section. Drop precisely on
      one. The blocker and its pair are exchanged for the dragged section and its pair,
      and one undo restores both sides.
- [ ] Still conflicting swap: drop on a swap target whose removal still leaves the
      incoming section clashing with another block. Nothing changes and the strip names
      the remaining conflict.
- [ ] Preview: toggle preview. The rails collapse, the grid becomes a full width
      poster with the plan label, credits, and date, and no add, remove, or drag
      control is present. Toggle back to edit.
- [ ] Reduced motion: enable the OS reduced motion setting and repeat the valid and
      blocked drags. Outcomes convey through color and text with no settle, pulse, or
      shake.
- [ ] Persistence: reload the page. The last used mode and language persist.
- [ ] Large category latency: run a by subject owner or all curricula search on a
      large category. If it runs past eight seconds, the catalog shows the slow query
      notice with a cancel action while the request continues. Let one such search
      finish and confirm it renders. Then run another and press cancel; the form
      returns to idle and a fresh search still works. Open the debug diagnostics
      request log and confirm the time to first byte, download, parse, and validate
      columns and the payload size are populated for the query.

## Plans, term scoping, and revalidation

- [ ] Plan switcher and CRUD: open the plan switcher in the header. Create a plan and
      confirm the default name is ตาราง semester/year. Rename it, duplicate it, and
      delete one behind its inline confirm. Switching plans updates the header and
      snaps the search form to that plan's term.
- [ ] Term scoping: with a plan for one term active, change the search term and search
      again. Every catalog row shows the different term state naming both terms, with no
      add control and a switch action, and a banner above the catalog carries the same.
      Use the switch: it moves to or creates a plan for the browsed term and the rows
      become addable. Confirm the first plan and its sections are untouched.
- [ ] Persistence across reload: add a few sections, then reload the page and reopen the
      panel. The grid rebuilds from the stored plan even though the catalog is empty. Two
      plans for different semesters stay separate.
- [ ] Revalidation on open: open a plan that has entries. A summary banner reports the
      check; with unchanged data it reads all up to date. Press refresh and confirm the
      outcome reports in the banner, not through a toast.
- [ ] Changed section: if a section's time changed upstream, its block carries a warn
      badge until acknowledged and the banner counts the change. Open the block detail
      popover and the revalidation detail sheet and confirm both show old versus new.
- [ ] Missing section: a section dropped upstream stays on the grid with a danger badge
      and a suggested remove. Confirm nothing is deleted without the action.
- [ ] Block detail popover: in edit mode, open a block's details control. The popover
      shows the metadata, the verification state, acknowledge for a changed entry, and
      remove. Escape closes the popover and not the whole overlay. It is absent in
      preview.
- [ ] Offline revalidation: block the network, then open a plan. It renders from
      snapshots with an unverified state and a working retry, and viewing is never
      blocked. Restore the network and retry.
- [ ] Quarantine: in a dev build, corrupt the stored plan blob. On reload the panel
      shows the quarantine card with an export action and starts from a clean state
      without losing the app.
- [ ] Error boundary: in a debug build, open the panel, open the diagnostics drawer at
      the bottom left, and press Throw in panel. The panel body shows the recovery card
      with a reload action while the header keeps its close control and the host page
      behind the overlay is untouched. Press reload and the panel body rebuilds. This is
      the only way to trigger the boundary; production has no such control.

## Export and import

Run these against a debug build in Chrome and Firefox. Preview mode is entered from
the header segmented control.

- [ ] Preview toolbar presence: in edit mode there are no sharing controls. Switch to
      preview and confirm the toolbar shows display options, copy image, download image,
      and copy as text. Switch back to edit and confirm they leave the DOM. The toolbar
      and the revalidation banner are never part of an exported image.
- [ ] Download PNG: populate a plan including one unscheduled course. In preview, download
      the image and open it. The poster header, the grid with block colours and any
      revalidation badges, the unscheduled shelf, and the footer credits all render, and
      Thai text is correct. The file name is kmitl-plan-year-semester-name.
- [ ] Copy image: use copy image, then paste into a chat app. The pasted image matches the
      poster. Where the browser lacks image clipboard support the control is a one line
      note pointing at download, never a dead button.
- [ ] Copy as text: use copy as text, then paste into LINE. The text reads cleanly in
      Thai with a header line of plan, term, and credits, one line per meeting ordered
      Sunday through Saturday, the unscheduled sections under a label, a missing marker on
      any dropped section, and a footer with the app name. There is no markdown.
- [ ] Display options are what you get: toggle fit to content, show room, show section,
      and show English names. The preview updates in place, and a re exported PNG and a
      re copied text reflect the same options. The options persist across a reopen.
- [ ] Fit to content: with fit on, the poster trims to the hours and days the plan uses and
      never hides the unscheduled shelf. With fit off, the full week and the default hours
      show.
- [ ] JSON export and import: from the plan menu, export the active plan to JSON. Open the
      file and confirm it is the durable plan. Tamper one field and import it: the menu
      lists the exact invalid fields and commits nothing. Import the clean file: a new
      plan lands under a suffixed name without overwriting the original, and revalidation
      reconciles its entries on open.

## Keyboard and screen reader

Run this whole section with the keyboard only first, then repeat it with NVDA on Windows.
The grid is a labeled group, not a table or grid role, so a screen reader reads it as a
region followed by each meeting as a self contained sentence in day then time order; there
is no arrow key cell navigation, by design, because every placement is fixed. Move and swap
are pointer only; a keyboard user reaches every section through the per row and per block
add and remove controls, so no action is a dead end for the keyboard.

- [ ] Reach and open: Tab from the page to the launcher and open the panel with Enter. Focus
      moves into the panel and Escape closes it and returns focus to the launcher.
- [ ] Search: Tab through the tab bar (the active tab reads pressed), open a combobox and
      filter with the arrow keys, Home, End, and Enter, then submit. The catalog announces
      loading, then the result count or the empty state.
- [ ] Add from a row: Tab to a section's add button and press Enter. The screen reader
      announces the add. Tab to the grip and press Enter or Space: it commits the same
      section or routes to the blocked feedback, and the outcome is announced.
- [ ] Blocked add and suggestions: press add on a time conflicting section. Focus stays
      reachable and the feedback strip states the reason and offers alternative section
      chips; Tab to a chip and press Enter to add it. When none fit, the reveal control
      filters the catalog to the subject.
- [ ] Exam overlap: add a section whose exam overlaps a placed one. The add succeeds and the
      strip states the exam overlap; the placed block reads its warn state in its label.
- [ ] Grid blocks: Tab through the placed blocks. The tab order follows the day then time
      order, each block announces subject, name, section, day, time, room, and any state,
      and its details and remove controls are reachable and labeled.
- [ ] Block popover: open a block's details control. Focus lands in the dialog, Escape
      closes only the popover and not the whole panel, and acknowledge and remove are
      reachable. A changed or exam overlapping block reads its state and, for an exam, both
      windows.
- [ ] Revalidation: open a plan with entries. The banner announces the check result through
      its live region. Reach the details control; the detail sheet opens as a dialog with
      focus inside it and Escape closes it.
- [ ] Plan switch: open the plan switcher, move through the plans, and create, rename, or
      delete one entirely by keyboard, confirming the inline delete.
- [ ] Preview toolbar: switch to preview and Tab through display options, copy image,
      download image, and copy as text. The display options popover is reachable and its
      toggles operate by keyboard.
- [ ] Import rejection: from the plan menu, import a tampered JSON. The per field error list
      is reachable and the back control returns to the menu.
- [ ] Footer and summary: the footer summary reads as one labeled region with the credit,
      subject, and per day load totals.
- [ ] Focus ring sweep: keyboard only, Tab through the search selects and inputs, the
      catalog filter field, the day chips, the credit control, the refresh button, the plan
      rename field, and the preview toolbar buttons. Each light control shows the inset
      orange ring fully inside its box, never clipped, including a field scrolled to the rail
      edge and a control inside the narrow viewport catalog drawer. The filled primary
      buttons, submit, retry, and the active day chip, show the orange ring on the
      surrounding surface.

## Firefox parity

The end to end suite runs on Chromium only, because Playwright cannot side load the
extension into its Firefox build (ADR-0030). This short list is the recorded Firefox
acceptance and is run by a person, not automated. Load the unpacked Firefox build with
`pnpm build:debug -b firefox`, then open `about:debugging`, choose This Firefox, Load
Temporary Add-on, and pick `.output/firefox-mv3-debug/manifest.json`. Open
`https://regis.reg.kmitl.ac.th/#/teach_table_selector`. The whole planner and export
lists above are meant to pass in Firefox too; these four items are the engine specific
risks to confirm deliberately, since they are where Firefox is most likely to diverge
from Chromium.

- [ ] Pointer drag: drag a section grip onto the grid and drop it. The grab card follows
      the pointer, the footprint ghosts show, and the drop commits a block. Repeat a
      blocked drag and confirm the reason chip and the rejected drop. The pointer events
      that drive the drag are engine specific, so this is the first thing to check.
- [ ] Download PNG: in preview, download the image and open it. The poster header, the
      grid with block colours, the unscheduled shelf, and the footer render, and Thai
      text is correct. The `html-to-image` capture path is the second engine specific
      surface.
- [ ] Copy image: use copy image and paste into a chat app. Where Firefox lacks image
      clipboard support the control is the one line note pointing at download rather than
      a dead button, so confirm which path Firefox takes and that it works.
- [ ] Shadow root isolation: with the overlay open, spot check that the host page styles
      do not leak into the panel and the panel styles do not leak into the host, then
      close the overlay and confirm the host page is exactly as it was.
