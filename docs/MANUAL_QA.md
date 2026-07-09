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
