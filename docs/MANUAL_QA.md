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
      the subject, opens the sheet or brings back a hidden course column, scrolls the
      card into view, and moves focus to it. When the results no longer list the
      subject, the strip offers a search for it instead, which runs by subject code in
      the plan's term.
- [ ] Strip timing and dismiss: rest the pointer on a blocked notice, or Tab into it,
      for longer than six seconds. It stays until the pointer leaves or focus moves on,
      then clears after the time it had left. The close control at its end clears it
      at once.
- [ ] Strip over the sheet: below 1024 px, open the course sheet and add a time
      conflicting section. The strip floats at the foot of the sheet above the dimmed
      backdrop and above the add toast, focus lands on the first alternative chip, and
      a tap on the chip adds it while the sheet stays open.
- [ ] Phone safe areas: on a phone with a notch and a home indicator, open the planner
      below 640 px. The header, the bottom nav items, the toast, and the launcher sit
      clear of the cutout and the home indicator, and the nav fill reaches the screen
      edge. Add a section from the catalog pane: the add toast sits above the nav. Add a
      time conflicting section: the strip floats above the nav, and above the toast when
      one shows.
- [ ] Phone remove bar: below 640 px, long press a placed block and drag it. The bottom
      nav turns into the remove bar, the timetable keeps its height, and dropping on the
      bar removes the section and its pair with an undo that restores them. The nav
      items return after the drop.
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
- [ ] Curriculum filter: run a category search, open the filters, and turn on the open
      to my curriculum switch. With no saved curriculum a picker opens with no term and no
      all options, prefilled from the class search; the switch stays off until a complete
      curriculum applies, and cancel leaves it off. After applying, only sections open to
      that curriculum and year remain, a removable chip shows, and the saved curriculum is
      named after a reload. Open a placed block's details and confirm the open to row
      names its curricula with the note about the search it was added from.
- [ ] Multi-meeting section: search subject 01476101 by subject id. Section 34 lists
      two Thursday periods in its catalog row, 08:45 to 10:15 and 10:30 to 12:00. Add
      it and confirm two blocks land on the grid, both on Thursday, and that copy as
      text emits a line for each. Then add another section that meets Thursday 10:30 to
      12:00 and confirm the add is blocked, since the second period is now in the
      conflict engine. The catalog summary shows a multi meeting count. A plan saved
      before this patch self heals on first open: its snapshot gains the missing period
      and a newly true conflict may surface, which is the designed discovered path.
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
- [ ] Revalidation on open: open a plan that has entries. The end of the stats bar under
      the grid reads ตรวจสอบแล้ว with the time of the check and a success check. Press the
      icon button ตรวจสอบอีกครั้ง and confirm it is disabled while the check runs and the
      outcome reports in the same place, not through a toast.
- [ ] Offline check: with the network off, check again. The status reads in warn that the
      plan shows saved data and offers ลองอีกครั้ง. Switch to preview and confirm the same
      status and retry end the toolbar row and never appear in an exported image.
- [ ] Changed section: if a section's time changed upstream, its block carries a warn
      badge until acknowledged and the status counts the change. Open the block detail
      popover and the updates dialog from รายละเอียด and confirm both show old versus new.
- [ ] Stats bar: the bar is a group named สรุปตาราง under both plan views, with the credit
      total as the larger number, the subject count, and ไม่มีรายการชนกัน. When a check
      creates a clash, the bar shows a danger button ชนกัน with the count; pressing it shows
      the timetable and focuses and pulses the first clashing block in time order. On a
      phone, with the day view on another day, the press first shows the clash's day.
- [ ] Updates indicator: after a check records a change, close the updates dialog with
      ดูภายหลัง. At 640 px and up a chip มีการเปลี่ยนแปลง n รายการ sits at the right of the
      plan view tabs; below 640 px the same chip heads the plan pane and the ตารางเรียน nav
      item carries a warn dot. The chip reopens the dialog and focus returns to it on close.
      A screen reader reads the chip wording once when it first appears, and the nav item
      name includes it. Acknowledge every item and the chip and the dot leave.
- [ ] Missing section: a section dropped upstream stays on the grid with a danger badge
      and a suggested remove. Confirm nothing is deleted without the action.
- [ ] Block detail popover: in edit mode, open a block's details control. The popover
      shows the metadata, the verification state, acknowledge for a changed entry, and
      remove from plan. Escape closes the popover and not the whole overlay, and focus
      returns to the block. It is absent in preview.
- [ ] Block detail sheet: on a touch screen at any width, or below 640 px with a mouse,
      tap a block. The details open as a bottom sheet with acknowledge and remove from
      plan pinned in its footer as large targets. Closing it returns focus to the block.
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

## Exam scheduling

- [ ] Exam block on add: add a section, then add another whose midterm or final overlaps
      it. The add is blocked, nothing lands on the grid, and the feedback strip states the
      exam reason, naming the blocking subject and section, the exam type, and its date
      range. Confirm a midterm never blocks against a final.
- [ ] Locale date range: read the blocked reason and the block detail popover in Thai, then
      switch to English. The year is the Buddhist year in both, for example 2569 for a 2026
      exam, and the month name follows the language.
- [ ] Alternatives exclude exam clashes: on the blocked add, the strip offers alternative
      sections of the same subject. Confirm a section whose exam also clashes is not offered,
      and that adding a clean alternative from the strip succeeds.
- [ ] Every path blocks: repeat the exam clash through a section drag, a course drag onto a
      candidate, the keyboard commit on a grip, and a swap onto the blocking block. Each
      routes to the same blocked feedback; none commits.
- [ ] Unscheduled exam: an online section with no meeting still blocks when its exam
      overlaps a placed one, and its shelf row reads danger.
- [ ] Discovered conflict on open: a plan populated before this change lights up danger on
      the blocks whose exams genuinely overlap the first time it is opened after the upgrade.
      This is the designed discovered conflict path, not a regression. Confirm the block
      detail popover lists both exam windows and that nothing is removed automatically.

## Export and import

Run these against a debug build in Chrome and Firefox. Preview mode is entered from
the header segmented control.

- [ ] Preview toolbar presence: in edit mode there are no sharing controls. Switch to
      preview and confirm the toolbar shows the display options, copy image, download image,
      and copy as text, and that the template picker is the preview gallery itself, not a
      dropdown. Switch back to edit and confirm they leave the DOM. The toolbar and its
      verification status are never part of an exported image.
- [ ] Download PNG: populate a plan including one unscheduled course. In preview, download
      the image and open it. The poster header, the grid with block colours and any
      revalidation badges, the unscheduled shelf, and the footer credits all render, and
      Thai text is correct. The file name is kmitl-plan-year-semester-name-template.
- [ ] Export templates: with the gallery picker, step through Share 16:9, Phone wallpaper
      landscape, Phone wallpaper portrait, Tablet wallpaper portrait, Tablet wallpaper
      landscape, and Print A4. The centred poster reflows to each aspect, and the caption below
      it states the localized name with the exact output pixels; there is no corner size label.
      Download each and confirm the opened image is exactly the stated pixels: 1920x1080,
      2400x1080, 1080x2340, 2048x2732, 2732x2048, and 3508x2480. The picked template persists
      across a reopen. At the largest preset, Print A4, the Thai glyphs are sharp and correct
      with no tofu boxes or clipped tone marks, and every day track, the shelf, and the footer
      credits are still present, never cropped. No block clips any field at any preset: the
      name stays and the lower fields drop whole rather than clipping (see the next items).
- [ ] Block hierarchy: every block leads with the subject name at the top, the place (building
      and room with a location glyph) reads as the promoted second line, the section is a corner
      chip, and the time sits as quiet metadata at the foot beside the subject id. Position
      carries the time, so the name owns the strongest slot and the time is quiet but present.
- [ ] Fields never half render: step through all six presets and sweep the blocks. No field is
      ever cut mid glyph. Every visible line sits fully inside its block, including Thai upper
      vowels and tone marks and low descenders. Where a block is short, the fields drop whole in
      priority, the subject id first, then the English name, then the time, then the section
      chip, then the name reduces to one ellipsized line, then the place, and the name never
      drops. The place always outlives the name's second line and the time never outlives the
      place. A long English name in the narrow portrait columns hyphenates or ends in an
      ellipsis, never a clipped glyph; Thai wraps on its dictionary. Turn show subject id on to
      pack the foot and confirm the fit still drops a field rather than clipping.
- [ ] Gallery picker: the selected poster is centred with the neighbouring templates peeking at
      both edges wide enough to read as a continuation cue. A pointer swipe past the threshold
      pages to the neighbour and a short swipe springs back. The dots below name each template
      on hover, and clicking one jumps to it. At the first template there is no left neighbour
      and at the last no right neighbour, so paging clamps rather than wraps. With reduced motion
      the slide is replaced by an instant switch.
- [ ] Portrait templates: the phone wallpaper portrait and the tablet wallpaper portrait fill
      the tall canvas top to bottom with days across the top as columns and time down the left
      axis, not a thin band. The block positions match the landscape reading of the same plan.
      Each landscape template keeps days as rows and time across the top, so the axis always
      matches the canvas orientation.
- [ ] Smart window: with a plan whose meetings all fall inside Monday to Friday 08:00 to 18:00,
      the poster shows exactly that window. A meeting before 08:00 or after 18:00 extends the
      window to the hour that clears it; a Saturday meeting reveals both Saturday and Sunday.
      The time axis hour labels are centred on their gridline with a stronger rule at midday and
      the window edges.
- [ ] Watermark: every export carries the quiet credit line in the bottom-right, in every
      template including portrait, legible but unobtrusive, never over a block, and present in
      the downloaded and the copied image.
- [ ] Day-color accent: in preview, confirm the day labels carry the traditional Thai day
      colours as a faint tint, the label text stays legible, and the accent appears in the
      exported image. In edit mode the day rows stay the plain alternating shade, and the
      subject block colours are unchanged in both modes.
- [ ] Copy image: use copy image, then paste into a chat app. The pasted image matches the
      poster. Where the browser lacks image clipboard support the control is a one line
      note pointing at download, never a dead button.
- [ ] Copy as text: use copy as text, then paste into LINE. The text reads cleanly in
      Thai with a header line of plan, term, and credits, one line per meeting ordered
      Sunday through Saturday, the unscheduled sections under a label, a missing marker on
      any dropped section, and a footer with the app name. There is no markdown.
- [ ] Display options are what you get: toggle show room, show section, show subject id,
      and show English names. The preview updates in place, and a re exported PNG and a
      re copied text reflect the same options. The options persist across a reopen.
- [ ] Show subject id: the option is off by default, so the poster blocks, the shelf, and the
      copy as text lines carry no numeric id and read name first. Turn it on and the id appears
      in all three. In edit mode the id always shows on the blocks regardless of the option.
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
      chips, and focus moves to the first chip; press Enter to add it. When none fit,
      the reveal control filters the catalog to the subject and moves focus to its card.
- [ ] Exam overlap: add a section whose exam overlaps a placed one. The add succeeds and the
      strip states the exam overlap; the placed block reads its warn state in its label.
- [ ] Grid blocks: Tab through the placed blocks. The tab order follows the day then time
      order, each block announces subject, name, section, day, time, room, and any state,
      and its details and remove controls are reachable and labeled.
- [ ] Block popover: open a block's details control. Focus lands in the dialog, Escape
      closes only the popover and not the whole panel, and acknowledge and remove are
      reachable. A changed or exam overlapping block reads its state and, for an exam, both
      windows.
- [ ] Revalidation: open a plan with entries. Press ตรวจสอบอีกครั้ง in the stats bar; the
      status announcer reads the outcome once, and an automatic check on open says nothing.
      Reach the details control; the updates dialog opens with focus inside it and Escape
      closes it.
- [ ] Plan switch: open the plan switcher, move through the plans, and create, rename, or
      delete one entirely by keyboard, confirming the inline delete.
- [ ] Preview toolbar and gallery: switch to preview and Tab through the display options,
      copy image, download image, and copy as text. Tab into the gallery dot radiogroup; the
      arrow keys and Home and End move between templates and the poster follows, each dot names
      its template, and the focus ring is visible. The display options popover is reachable and
      its toggles operate by keyboard.
- [ ] Import rejection: from the plan menu, import a tampered JSON. The per field error list
      is reachable and the back control returns to the menu.
- [ ] Stats bar and poster footer: the edit stats bar reads as one group named สรุปตาราง
      with the credit, subject, clash, and per day load totals, each day read by its full
      name. The poster footer line reads as its own labeled group.
- [ ] Focus ring sweep: keyboard only, Tab through the search selects and inputs, the
      catalog filter field, the day chips, the credit control, the refresh button, the plan
      rename field, and the preview toolbar buttons. Each light control shows the inset
      orange ring fully inside its box, never clipped, including a field scrolled to the rail
      edge and a control inside the narrow viewport catalog drawer. The filled primary
      buttons, submit, retry, and the active day chip, show the orange ring on the
      surrounding surface.

## Toolbar icon and shortcut

The end to end suite runs the click handler through the debug console handle, because
Playwright cannot click the toolbar or press a browser command (ADR-0062). The click
itself and the shortcut are checked here by hand, in Chrome, Edge, Opera and Firefox.

- [ ] Icon on a regis tab: with a regis page active and the panel closed, click the
      extension icon in the toolbar. The panel opens in that tab at the layout it had
      last, and no new tab opens. A second regis tab stays closed. Click the icon again
      with the panel open; it stays open.
- [ ] Icon on another site: with a tab on another site active, click the icon. One new
      tab opens at the search page and its panel opens by itself. Click the icon twice
      quickly from the other site; the second click brings that same tab forward rather
      than opening another.
- [ ] Shortcut: press Alt+Shift+P on Windows and Linux, or Option+Shift+P on macOS. It
      does the same as the icon click, on a regis tab and on another site. On Windows,
      repeat with both the Thai and the English keyboard layout, where Alt+Shift also
      switches the input language, and confirm the panel still opens.
- [ ] Shortcut taken or removed: clear the shortcut on the browser's extension shortcuts
      page, or assign Alt+Shift+P to another extension first. The icon still opens the
      panel, and a shortcut hint, where one shows, names only a shortcut the browser
      reports.
- [ ] Tooltip: hover the icon. It reads Course Planner for KMITL, with the (Debug)
      suffix in the debug build.
- [ ] Site access on click (Chrome): set the extension's site access to on click, then
      click the icon on a regis tab that has not been granted. Known limitation: the
      planner may need a page reload after the grant before the panel opens.

## Welcome after install

The welcome shows once per install, in the first visible regis tab the worker grants it
to, with the install tab first (ADR-0062). Start from a fresh browser profile and load
the debug build, so the install record is new.

- [ ] First visit: the install tab shows the welcome over the host page, with the
      launcher behind it and the host page not scrolling. Focus starts on Start planning.
      At 640 px and wider it is a centred dialog; below 640 px it is a bottom sheet clear
      of the home indicator.
- [ ] Content: the title, one sentence, three numbered steps with their icons, and one
      sentence on how to open the panel again. The sentence names the shortcut only when
      the browser reports one; clear the shortcut first and confirm the shorter sentence.
- [ ] Keyboard: Tab and Shift+Tab stay inside the welcome. Escape closes it, focus moves
      to the launcher, and the host page scrolls again.
- [ ] Close button and scrim: each closes the welcome, with focus on the launcher.
- [ ] Start planning: the welcome closes and the panel opens at the catalog, in edit
      mode, with focus inside the panel. Close the panel; focus returns to the launcher
      and the host page scrolls again.
- [ ] Exactly once: reload the tab while the welcome shows. It does not show again,
      since it is recorded as shown when it appears, not when it closes. Open another
      regis tab; no welcome.
- [ ] Toolbar click during the welcome: with the welcome open, click the extension icon.
      The welcome closes and the panel opens; the welcome does not return.
- [ ] Opened by a toolbar click: when the first regis tab after install is the one a
      toolbar click opened, the panel opens and the welcome waits. It shows in the next
      visible regis document instead, such as after a reload.
- [ ] Background tab: with the welcome still pending, open a regis tab in the
      background. Nothing shows there until it is brought to the front.
- [ ] Language: the welcome reads in the panel language, Thai in a fresh profile, and
      carries that language on its own node rather than the host page's.

## Entry toast

The entry toast is a short prompt beside the launcher, shown at most once per page load
(ADR-0063). Use the debug build in a profile past the welcome that has not turned the
prompt off. To turn it back on after an opt out, run
`chrome.storage.local.set({ 'kcp:onboarding': { schemaVersion: 1, welcomeShownAt: new Date().toISOString() } })`
in the service worker console, which keeps the welcome recorded as shown.

- [ ] No plan: with no plan stored, load the selector page. About two seconds after the
      page settles the prompt appears above the launcher, saying the planner can plan a
      timetable from the courses on this site. Open Planner opens the panel at the
      catalog in edit mode.
- [ ] Empty plan: create a plan with no subjects, then reload. The prompt names the plan,
      starting with its name so ตาราง is not read twice, and Add subjects opens the
      catalog.
- [ ] Plan with subjects: add two subjects, one of them a lecture and practice pair, then
      reload. The prompt names the plan and counts two subjects, and Open plan opens the
      timetable.
- [ ] Changes to review: with a plan whose revalidation found a change not yet reviewed,
      reload. The prompt counts the changes, and Review opens the timetable in edit mode
      with the updates dialog over it.
- [ ] Timing: the prompt hides by itself after about eight seconds. Rest the pointer on it,
      or tab into it, and it stays until the pointer leaves or focus moves out.
- [ ] Once per load: while it shows, and after it hides, move between host routes with
      the host page's own links and the browser back button. It never shows again and its
      message never changes until the next page load.
- [ ] Background tab: load a regis page in a background tab and wait. Bring it to the
      front; the prompt appears about two seconds later, not at once.
- [ ] Panel open: open the panel from the launcher while the prompt shows. The prompt is
      gone, and closing the panel does not bring it back.
- [ ] Close and Escape: the close button hides it for this page load only; reload and it
      shows again. With focus on one of its buttons, Escape hides it and focus moves to
      the launcher.
- [ ] Do not show again: press it. The prompt hides, focus moves to the launcher, and no
      later page load shows it in any regis tab.
- [ ] Keyboard and focus: the prompt never takes focus when it appears. From the launcher,
      Tab reaches its action, then Do not show again, then the close button.
- [ ] Screen reader: the message and its actions are read once when the prompt appears,
      in the panel language, and nothing is read when it hides.
- [ ] Install visit: in a fresh profile the install tab shows the welcome and no prompt,
      before or after the welcome closes. The next load of a regis page shows the prompt.
- [ ] Placement: at 390, 768 and 1366 px wide the prompt sits above the launcher on the
      right with a clear gap, wholly inside the screen, and on a phone it stays clear of
      the home indicator and the rounded corners. Under reduced motion it appears without
      the rise.
- [ ] Language: switch the panel to English, then reload. The prompt reads in English and
      carries that language on its own node.

## Firefox parity

The end to end suite runs on Chromium only, because Playwright cannot side load the
extension into its Firefox build (ADR-0030). This short list is the recorded Firefox
acceptance and is run by a person, not automated. Load the unpacked Firefox build with
`pnpm build:debug -b firefox`, then open `about:debugging`, choose This Firefox, Load
Temporary Add-on, and pick `.output/firefox-mv3-debug/manifest.json`. Open
`https://regis.reg.kmitl.ac.th/#/teach_table_selector`. The whole planner and export
lists above are meant to pass in Firefox too; the items below are the engine specific
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
- [ ] Toolbar icon placement: after loading the add-on, the icon sits pinned in the
      toolbar rather than only in the extensions menu.
- [ ] Host access on click: withhold the add-on's access to the two KMITL sites, then
      click the icon. Firefox asks for access to both sites. Declining opens nothing and
      changes nothing; allowing opens the panel as in the Chrome list above.
- [ ] Session area: on Firefox 115 or later, a click from another site opens the search
      page with the panel open. On an older Firefox the search page opens without the
      panel opening by itself, and nothing breaks.
- [ ] Welcome with tabs already open: open two regis tabs, then load the add-on so
      Firefox injects into them. The welcome shows in the install tab only, and neither
      earlier tab shows it when brought to the front.
