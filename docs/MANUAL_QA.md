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
