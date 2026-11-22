# 48. Responsive layout tiers and search in the catalog column

Status: Accepted
Date: 2026-11-05

Amends brief section 6.1 (the three region layout and the catalog drawer below 1280 px) and
section 6.9 (no mobile browser support).

## Context

The panel body is three regions at every width: a fixed 320 px search rail, a 24rem catalog
column shown only from the xl breakpoint, and the grid. Below 1280 px the catalog moves into a
slide over drawer while the rail stays. A review at nine viewports found the rail is the cause of
the narrow width failures. At 390 px the grid gets 40 to 70 px and its empty state breaks one
character per line. At 768 and 960 px it gets 416 to 608 px, under its own 704 px minimum, so it
clips at 15:00 or 19:00. At 1280 by 720 and 1366 by 768 the grid ends at 17:00 and 19:00. Once a
search has run, the form is dead weight for the add loop, yet it keeps the widest fixed column.

The same review found that `Layout` renders one catalog element in two places, the xl column and
the drawer, so both copies mount at every width. Every draggable section id is registered twice in
one drag context, the slow query timer and its status region run twice, the focus trap ends on a
hidden button so Tab escapes to the host page, and the closed drawer is aria hidden but not inert,
so Tab walks into invisible controls. Search submit never opens the drawer, so below 1280 px the
results land in a closed container with no visible or announced signal, and with the drawer open
the feedback strip and its alternative chips sit under the scrim.

Section 6.9 lists mobile browser support as a non goal, and section 6.1 fixes the three regions.
Both have to change for the panel to work below 1280 px, and the phone case carries two facts that
cannot be checked from the repository. Firefox for Android is the WebExtension runtime a phone
user would have, and addons.mozilla.org lists an extension for it only when the manifest declares
Android support. Whether the live host declares a width=device-width viewport meta tag is
unverified; without it a phone lays the page out at about 980 px and scales it down, so no narrow
breakpoint fires, and rule 6 forbids the extension from adding the tag.

## Decision

Three compositions, chosen by overlay width at the Tailwind default breakpoints through one
media query hook and one pure tier function:

- Compact, below 640 px. One pane at a time behind a bottom nav. The catalog pane holds the
  search, the filter bar and the results; the plan views from ADR-0049 fill the other panes.
- Medium, 640 to 1023 px. The grid takes the full width. The catalog column is a modal left sheet,
  24rem wide and at most 90 percent of the viewport, opened from a labelled header toggle that
  carries the result count in its visible text and its accessible name.
- Wide, 1024 px and up. The catalog column is docked beside the grid with no scrim, 22rem at lg,
  24rem at xl and 26rem at 2xl, and the student can hide it from its own header and restore it
  from the edge rail that takes the column's place (see the amendment below).

The 320 px search rail is removed at every width. Search becomes the head of the catalog column.

One mount. `CatalogPanel` mounts exactly once at every tier, and only its container class
switches between pane, sheet and docked column, so a tier change never remounts it. Each section
id therefore has exactly one drag surface. A hidden Compact pane, a closed Medium sheet and a
hidden Wide column stay mounted, marked hidden and inert, and are never conditionally rendered, so
the 6.1 session state, the scroll offset and the drag registration survive tier and pane switches.
While the Medium sheet is open, the header and the grid region are inert, focus stays in the
sheet, Escape closes the sheet alone, and focus returns to the toggle. The preview early return in
`Layout` still unmounts the catalog, as ADR-0022 requires.

Search as an inline disclosure. The search form sits at the head of the catalog column in all
three containers. Expanded, it shows one shared term row, the tabs and their fields, and a full
width submit under the last field. Collapsed, it is a short sticky summary bar naming the tab, the
query, the term, the result count and the data time, with an edit action and a rerun action. It
starts expanded on first run and whenever no result exists, and it collapses on its own once a
user submit settles with data or an empty result. On Medium and Wide, expanding pushes the results
down, so the student refines with the list in view. On Compact, the expanded form fills the pane
and the results stay mounted but hidden while editing. Because submit and results share one
container, a result can no longer land somewhere closed.

Live region inventory. The panel carries a fixed set of live regions, and a test asserts the set.

- `StatusAnnouncer`, one persistent visually hidden status region in `Layout`, outside every
  swapped or hidden subtree, owns settled search outcomes: the result count, the empty title with
  the search summary, or the error title, for user submits only.
- `FeedbackStrip` keeps its one polite node and owns placement outcomes: valid, blocked, removed,
  and the screen reader only added line. It renders once; its anchoring per tier is a container
  class, at the top of the grid column on Wide, at the bottom of the open sheet or of the grid on
  Medium, and above the bottom nav on Compact, so it is never under a scrim.
- The `Toaster` region keeps its own outcomes, including `UndoToast`, which it hosts: copy and
  export results, cache clear, an unchanged refresh, undo availability, and an add confirmed while
  the grid is not visible.
- A modal that hides the rest of the page from assistive technology, such as the planned section
  comparison table, carries one scoped node of its own, because the persistent regions are
  unreachable while it is open. The Medium sheet is not such a modal for this purpose: its inert
  scope covers the header and the grid region only, and the three persistent nodes sit outside it.
- Status indicators, such as a save state or an updates count, announce through `StatusAnnouncer`
  and are not live regions themselves.
- Existing nodes that stay: the catalog loading state keeps its busy status while a query is in
  flight and unmounts on settle, so it never carries the outcome; the recovery card and the
  quarantine card keep their alert role for errors; and the revalidation banner keeps its polite
  region until a later record replaces the banner.

No second region may announce an outcome one of these already owns, so an outcome is read once.

Phone support gate. The Compact tier ships for narrow desktop windows, split screens, high zoom
and tablets regardless of phone support, because those widths exist on the browsers already
supported. Section 6.9 is amended so narrow and touch layouts are in scope. Claiming phone browser
support, in the store listing, the README or a manifest declaration for Firefox for Android, stays
gated on two live checks: the host page declares a width=device-width viewport meta tag, and the
extension runs on the live host in Firefox for Android. The extension never injects a viewport
tag. A later record states the result of both checks and either completes the claim or records
that it is not made.

## Alternatives considered

Keeping the drawer up to 1279 px, the current rule, was rejected for 1024 to 1279 px: a docked
22rem column still leaves about 640 px of grid, enough for the working day under ADR-0050, and
docking keeps catalog to grid drag available with no scrim. Keeping the three regions from 1280 to
1440 px was rejected because the rail costs 320 px and clips the grid at 17:00 and 19:00 on the
two most common laptop sizes. Docking from 960 px was rejected because it leaves about 576 px,
under the 600 px grid minimum. Custom breakpoints were rejected because the Tailwind defaults
already cut at the device clusters that matter.

A search modal was rejected: it nests a second focus trap inside the overlay dialog, hides the
results being refined, and adds a step to the most repeated action. A collapsible icon rail was
rejected because it still reserves a column, cannot carry a Thai summary, and hides what was
searched. A top search bar was rejected because the curriculum tab has six fields plus the term,
which wrap at 1280 px, and it spends height, the scarcer axis on 720 and 768 px laptops. An
anchored popover was rejected because the comboboxes inside it would stack floating layers.

Two catalog mounts switched by media query were rejected because a remount on resize loses the
scroll offset and the drag registration, and the current double mount is the cause of the focus
escape. A second feedback strip inside the catalog was rejected because two live regions would
announce the same outcome twice.

## Consequences

Every width has one composition and one mount per component, which keeps the state space small and
removes the duplicate drag surfaces and the focus escape. At 1366 by 768 the collapsed search bar
takes about 56 px of height instead of a 320 px column, so the grid gains the width the working
day needs. The live regions are a closed, tested set, so later features add announcements through
the existing owners rather than new nodes. The tier ships without a phone support claim, and the
claim waits on live evidence rather than an assumption about the host page. Existing ADRs stay
unchanged; the brief sections 6.1 and 6.9 are read through this record.

## Amendment: the form folds at submit (2026-11-06)

The owner reviewed the live build and found that a search press gave no sign it was accepted.
On a 1280 by 720 laptop the curriculum form pushed the loading skeleton below the fold, and a
repeated search answered from the ten minute cache changed nothing visible. The decision above
collapsed the form once a user submit settled, which is the moment the student had already
stopped trusting the press.

The form now folds when a user submit is accepted, not when it settles. One store write marks
the result as loading, records the query the bar describes, closes the form and stamps the
submit time, before the first await, so the bar, the folded form and the loading state land in
the same frame. Retry and refresh run as background queries that replace the result and leave
the disclosure as the student set it. A blocked submit, such as a subject id under eight digits,
changes nothing, and settling with data, an empty result or an error never changes the
disclosure either.

The bar is a fixed head of the column, outside the results scroller, not a sticky bar inside it.
The column is the container header, the search head and then the results scroller. The bar names
the tab and the term of the running search and carries a status slot that reads the busy text
while the query runs and the course count once it settles; the query name, its scope, the data
time and the rerun action join it in later steps. Its disclosure keeps one label and reports its
state through aria-expanded. Because the bar sits outside the scroller, nothing covers a focused
row, the drag autoscroll area stays equal to the list, and opening or closing the form never
moves the list.

A reopened form scrolls in its own region above a minimum of 12rem of results. This is a
deliberate exception to the column scrolling as one: at 1280 by 720 the curriculum form is
taller than the room left, and letting it push the results out of view would hide the list the
student is refining. Before any user search there is no bar and no minimum, so the form takes
the space it needs as before.

An accepted submit moves focus to the bar, because the folded form turns inert, and the bar is a
region rather than a button, so a repeated Enter starts nothing. Cancelling a slow search clears
the bar, reopens the form and moves focus to its submit. For 500 ms after a user submit the
results ignore pointer input, so the second click of a double click cannot land on a card or an
add button that rose under the pointer.

The fold animates the region's grid row over the base duration with a standard easing token, the
form fades faster than it folds, and reduced motion removes every transition so the swap is
instant. The results scroll offset is kept across a fold, an expand and a tier change, and a new
user search starts the results from the top. Offsets are kept within one overlay session only:
the overlay unmounts its body when it closes, so they reset on reopen, a gap against section 6.1
that a later change can close by keeping the offset in the ui store.

## Amendment, 2026-11-06: restore the docked column from an edge rail

The first Wide build put the hide control at the far end of the docked column's header and
the restore control in the panel header, so hiding and restoring the column took two trips
across the screen. The Wide restore moves to an edge rail at the column's place.

- While the docked column is hidden, a 44 px rail renders after it in the tree, on the same
  layer, so it paints above the hidden column. It is one native button: an open icon in a
  48 px top cell, then the result count chip, or a busy dot while a search is in flight, then
  a vertical label. Its accessible name carries the label and the count, or the searching
  state, and it has no title and no expanded state, because it can only show the column.
- The hide control moves to the leading edge of a 48 px docked header row and opens with a
  44 px icon cell, so the hide icon and the rail icon centre on one point at every docked
  tier. Hiding focuses the rail and restoring focuses the hide control, so focus lands where
  the pointer already is.
- The header toggle renders only on the sheet tiers, so each tier has one restore control.
  Opening the sheet also shows the docked column, so a student who asked for the catalog on a
  narrow window finds it shown after widening; closing the sheet leaves the docked choice.
- Every show and hide goes through one funnel. It refuses to toggle during any drag, a section
  drag, a course drag or a block move, because the grid width is frozen for the length of a
  drag, and the rail takes no pointer events while one runs. It ignores the second click of a
  multi click and a pointer activation within 200 ms of the previous pointer toggle, because
  the two controls share one point and a quick second click would undo the first. A keyboard
  activation is never throttled.
- A tier change that crosses the dock boundary, such as a browser zoom, can unmount the
  focused catalog control. When focus is lost that way, it moves to the catalog control of
  the new tier; focus on any other element is never moved.

This rail is not the search rail this record removes. It holds no form and no results, it
costs 44 px only while the column is hidden, and the column behind it stays mounted with its
scroll offset, search state and drag registration, as the one mount rule requires.

The hidden column and the rail are never a remove target. A later catalog remove zone may
accept a block dropped on the shown column, but a hidden column is out of view and the rail
is too narrow to aim at and is not a drop zone, so a block move dropped over either of them
while the column is hidden commits nothing.

Alternatives considered: an invisible hot zone at the panel edge was rejected because it
cannot be discovered, offers nothing to touch or keyboard users, and fires when the pointer
enters from a left taskbar or another monitor. An auto hide flyout over the grid was rejected
because it covers the early hour columns where drops land and adds a third container state.
Opening on hover was rejected for the same accidental trigger reason; hover may only hint.

## Amendment, 2026-11-06: the open sheet's inert scope

The decision above makes the header and the grid region inert while the Medium sheet is open.
The build narrows that scope to the grid region, the part the scrim covers. The header sits
above the scrim and looks live, so making it inert would turn a visible control into a dead
click, and its catalog toggle is a disclosure whose expected behavior is to close what it
opened.

- The closed sheet stays mounted, inert and hidden from assistive technology on every sheet
  tier, the same rule the hidden docked column follows. A window narrowed past the dock while
  focus sits in the docked column moves that focus to the header toggle, because the column
  turns into the inert closed sheet and the browser would drop the focus to the body.
- The open sheet is a dialog named by its heading. It takes focus as it opens and keeps Tab
  inside it with the shared focus trap, so the keyboard reaches the header only after the sheet
  closes. It is not marked aria-modal, because the header stays operable.
- The scrim is a pointer target only: it is not a tab stop and is hidden from assistive
  technology, because the sheet header close carries the same action.
- Escape closes the sheet alone. The sheet claims the press through claimEscape in a React
  handler on its container, so a surface inside it that holds focus, such as an open combobox
  list or the search form fold, claims the press first, and the overlay decides last, as
  ADR-0056 routes it. The press that ends an input method composition stays with the editor,
  as it does for the overlay. A native escape layer on the sheet was rejected because it runs
  before the React handlers inside the sheet.
- Every sheet close, from Escape, the sheet close or the scrim, moves focus to the header
  toggle, because the control that closed it turns inert.

The feedback strip still renders inside the grid region, so while the sheet is open it is inert
with the grid until the strip moves to the place the live region inventory above gives it on
Medium, at the bottom of the open sheet.

## Amendment, 2026-11-06: the rail peeks and the docked column slides

The owner asked for a shadow of the drawer at the left edge and for motion as the column comes
and goes. Both apply on the docked tiers in edit mode only; the sheet tiers keep their own slide.

- Hovering the rail, or reaching it with the keyboard, slides a 12 px shadowed edge of the
  column out from behind it over the fast duration. The edge sits in the grid region's padding,
  takes no pointer events and never opens anything; only a click, tap, Enter or Space opens the
  column. The hover rule lives inside a hover capable media query, so a tap on a touch screen
  never leaves it stuck. It waits an 80 ms intent delay, a new token, so a pointer passing
  toward the browser edge does not flash it, and it leaves at once. It is off during any drag.
- A pointer hide mounts the rail under the pointer, so the hint is held off until the first
  pointer move that lands outside the rail; otherwise it would slide out while the column slides
  away. A pointerleave on the rail cannot end the hold, because Chromium sends no enter or leave
  to an element that mounted under a still pointer. A keyboard hide holds nothing, and focus
  moved after a click does not match focus-visible, so it does not show the hint either.
- Showing the column slides it in from the panel edge over the base duration, 200 ms, on a
  decelerating enter easing. Hiding slides it out over the fast duration, 150 ms, on an
  accelerating exit easing, until it tucks behind the rail. Neither overshoots, because a bounce
  would shake the column edge beside a dense timetable.
- The show and hide funnels start the slide through the Web Animations API after the visibility
  change commits. The column moves by transform only, and the drawer shadow lives on a separate
  child that fades by opacity, so both stay on the compositor. A leaving column keeps its
  visibility through a third effect and then drops to the hidden state its classes already hold.
  Every effect fills none, so an ended or cancelled slide leaves the column exactly as its
  classes say, and a running slide is cancelled before the next starts. Durations and easings
  are read from the tokens on the shadow host; a token that cannot be read means no motion,
  never a hardcoded copy. A finish call lets a later drag start measure the column at its final
  position.
- Reduced motion skips the slide, shows and hides the hint in the same frame with no delay, and
  stops the busy dot pulsing.
- Focus moves at the start of a slide. On a show it lands on the hide control while the column is
  still sliding in, so for up to 200 ms the focused control is partly out of view. This is
  accepted as transient: it ends where the rail's icon was, where the pointer already is.

The grid takes its new width in one step at the start of each slide rather than following the
column. An animated width would re-lay out the whole CSS grid and every block on every frame,
the edit window of ADR-0050 derives its minimum width from the visible quarters, and every edit
block re-measures its fit from ADR-0046 through a resize observer, so a width animation would
run the fit on every block about twelve times per toggle.

Alternatives considered: a transient store field driving CSS keyframes was rejected, because it
renders the panel twice per toggle, depends on an animationend event that bubbles from the
course cards and never fires under reduced motion, and can replay after a tier change or a
preview round trip. Animating the column's box shadow or visibility inside the transform effect
was rejected because either moves the slide off the compositor. Animating the grid width was
rejected for the relayout reasons above.

## Amendment, 2026-11-06: the audited live region inventory

The inventory above was written before the status announcer existed. With it in place, every
node that announces was audited against the source and the rendered panel, and
`src/features/shell/liveRegions.test.tsx` now asserts the set. A new live node fails that test
until this record and the test change together.

- `StatusAnnouncer`, in `Layout` beside the catalog column, speaks when a user search settles:
  the course and section count, the empty title with the searched term, or the error title. The
  search store records the intent of each run in the same write as its query, so a refresh
  replaces the result without a word. A retry pressed on the error state is spoken, because the
  student asked again after an outcome that was spoken. The message is written at the settle,
  so a re-render, a language change or a remount never repeats it. A result that lands while the
  sheet is closed or the docked column is hidden is still spoken, because the announcer sits
  outside both. Preview has no search and carries no announcer.
- `FeedbackStrip` speaks placement outcomes, and its screen reader only added line only while
  the timetable is in view. While the sheet is open the strip is inert with the grid, which is
  why an add over the open sheet speaks through the toast instead.
- The `Toaster` region speaks its toasts, the undo toast it hosts, and an add made while the
  sheet covers the timetable. That add toast offers one action, ดูตาราง, which closes the sheet
  and returns focus to the catalog toggle. One confirmation funnel picks the toast or the strip
  line for each add, never both, so the add is read once.
- Scoped and transient nodes: the catalog loading status, the loading status inside the
  suggestion modal, the alerts of the recovery and quarantine cards, and the revalidation banner.
- The drag library mounts one region of its own inside the drag context. It speaks the drag
  lifecycle in its default English wording with internal ids, which overlaps the placement
  outcomes the strip owns. It is listed so the gap stays visible; replacing its announcements
  with the panel's own wording is left to the drop zone vocabulary change.

The summary bar is not part of the inventory. It is a focusable region that reads its busy text
when focus lands on it, not a live region.

## Amendment, 2026-11-06: the compact panes

The first build below 640 px kept the medium sheet, so on a phone the catalog slid over nearly
the whole grid it adds to. The compact tier now ships as the decision above describes it.

- The ui store holds a session only `mobilePane`, the catalog or the plan. The plan pane shows
  the plan view, and the bottom nav sets that same field, so the nav and the medium and wide
  tabs always show the same view and a widened window keeps the student's choice.
- The pane is settled once, the first time the compact tier lays out: the plan when it already
  holds entries, the catalog otherwise. After that it changes only on request, so an add never
  switches panes, and it survives closing the overlay. Deriving the pane from the entries on
  every render was rejected because the first add from an empty plan would leave the list.
- The catalog column and the grid region share one grid cell above the nav, so both keep the
  same box. The pane not shown is invisible, inert and hidden from assistive technology, never
  unmounted and never display none, which would drop its scroll offset. Every element keeps its
  place in the tree at every tier, so the one mount rule holds across a tier change.
- The bottom nav is a nav landmark of plain buttons, and the item on screen carries
  aria-current, because each item swaps the whole pane rather than a panel in place. Pressing an
  item keeps focus on it. Each item is at least 56 px tall, and the catalog item carries the
  result course count and the selected item the placed subject count, both in the accessible
  name. No live region is added, so the inventory above is unchanged. Three items ship first:
  รายวิชา, ตารางเรียน and ที่เลือก. สรุป joins with the summary view, and the review dot on
  ตารางเรียน arrives with the review data, so no item renders a slot without a source.
- The header toggle and the scrim belong to the medium tier alone, and the pane header carries
  the catalog name, the result count and the plan suggestion action but no close, so each tier
  has one way to the catalog.
- Catalog drag is off below 640 px. The timetable sits in the other pane, and its drop zone
  keeps its box at the same place, so a drag from the list would commit an add the student never
  saw. The column provides the choice through one context, so the rows read it without each
  subscribing to a media query; a row is no drag source and the course header is a plain header.
  The section grip and the add buttons keep the add one press away. Disabling the drop zone
  instead was rejected because the drag would still start with nowhere to go.
- An add made while the catalog pane is shown is confirmed by the toast, and its ดูตาราง action
  shows the timetable pane and focuses its nav item. The show in the list action of the
  feedback strip switches to the catalog pane. The focus repair runs when a tier change crosses
  between the nav, the sheet toggle and the docked controls, and below 640 px it lands on the
  nav item of the pane on screen.

Two gaps remained for the safe area change that follows. The toast region still sits at the
panel bottom, over the nav, and the feedback strip rendered in the plan pane, so a blocked add
made from the catalog pane routed its alternatives to a hidden strip. The amendment below floats
the strip above the nav, which closes the second gap. The safe area change pads the nav, the
toaster and the launcher for the device safe areas. The phone support gate above is unchanged.

## Amendment, 2026-11-06: the feedback strip floats above the sheet

The open sheet's inert scope left the strip in the grid region, so below 1024 px a blocked add
from the sheet showed alternative chips under the scrim that could not be tapped, and focus
could not move to the first of them. The strip now mounts by tier, still once, so one polite
node speaks each outcome.

- On the docked tiers it stays at the top of the grid column with its reserved height, so a
  notice never shifts the grid.
- Below them `Layout` renders it after the scrim and outside the inert grid region. It floats at
  the foot of the open sheet at the sheet's width, or at the foot of the grid while the sheet is
  closed. Below 640 px it floats over whichever pane shows, 72 px above the container foot, so
  it clears the 56 px bottom nav.
- While a toast or the undo toast shows, the floating strip rises above the toast region,
  because the add toast left by the previous pick would otherwise cover the chips of the next.
- While the floating strip has a height it sets `--kcp-overlay-bottom` on its container, and the
  catalog results and search form scrollers use it as their bottom scroll padding, so a control
  focused at their foot is not hidden under the strip (WCAG 2.4.11).

Each notice waits on one pausable window from `useAutoClear`: it holds while a hovering pointer
rests on the strip or focus is inside it, and resumes with the time left (WCAG 2.2.1). Every
visible notice ends with a dismiss control, ปิดข้อความ. The show in the list action shows the
catalog pane, opens the sheet, or slides a hidden column back, scrolls the course into view and
focuses its toggle, and when the result no longer lists the course the notice offers a by
subject id search for it in the active plan's term instead.

The strip entry in the live region inventory changes with it: the strip is no longer inert while
the sheet is open. Its screen reader only added line still stays empty while the sheet covers
the timetable, and the add toast speaks instead, so an add is still read once.

## Amendment, 2026-11-06: the phone safe areas

The panel ignored the device safe area insets, so on a notched phone a control could sit under the
cutout or the home indicator, and the toast region sat over the bottom nav. Every surface pinned
to a viewport edge now pads by the matching `--kcp-safe-*` token, which resolves to zero on a
device with no inset.

- The header already pads the top and side insets. The overlay body pads the side insets, and the
  bottom inset everywhere except while the bottom nav runs along its foot, the compact tier in
  edit mode. The nav pads below its items by the bottom inset instead, so its fill reaches the
  screen edge and its items stay clear of the home indicator. Padding the whole overlay root was
  rejected because the header would pad the top and side insets twice.
- The toast region and the launcher keep their 16 px and 20 px edge offsets, or the inset where
  that is larger, through `max()`. While the nav shows in the open panel, the toast region rises
  72 px above the bottom inset, so a toast no longer covers the nav item its action leads to.
- During a block drag the nav turns into the remove bar of ADR-0059. Its items hide and go inert,
  and the bar lays over the nav's own box, padded by the bottom inset as the nav is. The nav keeps
  its height, so the timetable above does not resize mid drag. On the medium tier and while the
  docked column is hidden the bar stays at the panel bottom, which the overlay body already keeps
  clear of the inset.
- The floating feedback strip adds the bottom inset to its offsets below 640 px, where its
  container runs to the screen edge behind the nav, and above a toast it rises clear of the
  lifted toast region. It stays at most 32rem wide over either pane, and a sheet left open on a
  window that narrowed below 640 px no longer gives it the sheet's width.

This closes both gaps the compact panes amendment recorded. The live region inventory is
unchanged.

## Amendment, 2026-11-06: phone sheets and the full pane search

The compact panes shipped with the wide tier's anchored menus and with the search form laid
out as on the wider tiers. On a 360 px phone the w-72 plan menu left almost no margin, its row
actions sat at the screen edge under a thumb, and a long curriculum form pushed its submit
below the bottom nav. Below 640 px every popover larger than a short menu now opens as a
bottom sheet, as the block details already do under ADR-0049, and the search takes the pane.

- The plan switcher menu and the display options open as bottom sheets named by their
  trigger label, with the same content as the popovers. A sheet carries its own scrim, focus
  trap and Escape layer, lands focus on its heading and returns it to the trigger, which
  reports a dialog popup in that form. The floating outside press dismiss is off while a
  sheet is in use, because the sheet portals outside the floating context and every tap
  inside it would read as an outside press. From 640 px up both stay anchored popovers.
- The panel portal context now covers the header as well as the body, so a header control
  can open its sheet over the whole panel. Before this a header surface had no portal node.
- An open search form fills the catalog pane. The search head lays over the results, which
  stay mounted but invisible and inert beneath it, never display none, so the list keeps its
  scroll offset while the student edits the search. The hidden state is derived at render
  from the tier and the disclosure and never stored, so a widened window cannot strand it. A
  user submit folds the form as on every tier and reveals the bar and the results, and the
  feedback strip's show in the list action folds it too, or the card it opens would stay
  hidden and could not take focus.
- The submit row is pinned to the foot of the form scroller, above the bottom nav, and the
  scroller adds the row's measured height to the `--kcp-overlay-bottom` reservation of the
  floating strip as its bottom scroll padding, so a focused field never sits under either
  (WCAG 2.4.11). While a running search has a bar, the row carries ยกเลิก
  beside the submit; it folds the form back under the bar and moves focus to the disclosure,
  the same fold Escape gives. Before any search there is no bar to fold to, so no cancel shows.
- The section grip drops out with the catalog drag. Its name promises a drag to the
  timetable that the phone pane cannot offer, and its press only repeated the row's add
  button, so the add button alone carries the commit. The row keeps its element and its
  disabled drag registration, so a tier change never remounts it under a focused control.
  The course header stays a plain disclosure with no drag source, as the compact panes
  amendment above set it.

The block details sheet of ADR-0049 is unchanged. The live region inventory is unchanged:
neither the sheets nor the pinned submit add a live node.

## Amendment, 2026-11-07: the entry toast live region

The entry toast and launcher attention record, ADR-0063, adds a prompt beside the launcher on a
visit. Its polite region joins the audited inventory as the one node anchored to the launcher, and
`src/features/shell/liveRegions.test.tsx` lists `features/onboarding/EntryToast.tsx` with it.

- `EntryToast` owns the entry prompt and nothing else. The region is mounted empty from the start
  and carries the panel language in `lang`, since it sits outside the overlay root, so the prompt is
  announced once when its text arrives and in the voice of the language it is written in. No
  outcome another region owns is read through it.
- It never coexists with the panel toasts of the `Toaster` region. It shows only while the panel is
  closed and hides for good when the panel opens, and the `Toaster` clears its panel toasts when the
  panel closes. A debug toast shown while the panel is already closed sits at the bottom centre,
  below the entry toast, which rests 60 px above the launcher's bottom offset on the right.
- The prompt is a separate surface from the one toast pattern of brief section 8.2, a deviation
  that ADR-0063 records and that sets no precedent: action feedback still goes through the toast
  store and the `Toaster` region.

## Amendment, 2026-11-07: the comparison table node

The section comparison table now adds sections, so it takes the scoped node the decision above
set aside for a modal that hides the rest of the panel from assistive technology.

- One visually hidden status node inside the dialog speaks the outcome of each add from the
  table: the section added, the reason a blocked add was rejected, or the plan a term switch
  made active. The add goes through the same add path as the catalog row, so the plan's checks
  decide, but the table leaves the feedback strip and the toast silent, because both sit under
  the modal, and each outcome is read once.
- The node lives as long as the dialog. Closing the table ends it, and the persistent regions
  speak again from there.

`src/features/shell/liveRegions.test.tsx` lists the node with the table that owns it.

## Amendment, 2026-11-07: the data time and the search after a reload

The decision above opened the form whenever no result existed, so a page reload always met the
student with the full form, even though the last search is kept in storage. The bar now carries
the data time and the one action on the result, and a reload restores the bar.

- Once a catalog settles, the bar reads ข้อมูล ณ with the time the worker fetched the courses. A
  cache hit reports the time of the fetch that filled the cache, not the time it was read, and an
  entry stored before fetch times were kept reads as a miss rather than showing an invented age.
  Past the ten minute cache lifetime the line turns warn and its clock becomes a warning sign, so
  the cue does not rest on colour alone. One timer is armed for that moment instead of a ticking
  clock. The time is transport metadata, so it travels beside the normalized catalog in the
  worker answer rather than inside it.
- The catalog refresh moves into the bar as an icon button named โหลดผลค้นหาใหม่, beside the time
  it acts on, so it no longer shares a label with the plan check. It runs in the background and
  bypasses the cache, and only a refresh that changed nothing confirms itself through a toast.
- After a reload the persisted search reopens folded into its bar, with ค้นหาอีกครั้ง in place of
  the refresh. The rerun is a user search, so the status announcer speaks its outcome and the
  input guard applies, and it reuses the worker cache while that is still valid. It runs only when
  pressed, since the host should see one request per explicit action. The rerun and the refresh
  are one element, so focus stays on it when the press turns one into the other, and it stays
  mounted while the query runs, held through aria-disabled and described by the busy text beside
  it.
- The stored search starts loading when the content script mounts, so it is ready by the first
  open, while the term seed still waits for that open, so a host result route captured then wins.
  A route on another term opens the form on that term with no bar, since a bar naming the other
  term would describe a search the form no longer holds. The forms, the term and the restored bar
  land in one store write, and until it lands the search head holds a fixed placeholder with
  neither the form nor the bar, so nothing paints and then flips.

## Amendment, 2026-11-19: the filter result

The catalog filters narrow the list in place without moving focus, and nothing spoke the
outcome, not even the line that no course matches. That is a status message under WCAG 4.1.3,
so `StatusAnnouncer` now reads it as well.

- Once a filter change has held still for 500 ms, the announcer reads the filtered course and
  section count, or the no match line. Typing a word restarts the wait, so it reads one result
  rather than one per key.
- Only a filter change arms it. A re-render, a plan change that shifts the count, or a language
  change says nothing, as the search outcome already behaves.
- The catalog alone can count the filtered result, since the conflict and shortlist tests depend
  on its derived state, so it hands a resolved line to the announcer through a small status
  store rather than the announcer repeating that work. No live region is added, so the inventory
  above is unchanged.

## Amendment, 2026-11-20: the quieter header

Feedback from students testing on phones named the header save mark as a distraction: it
changed on every edit and asked nothing of them. The header also carried the language toggle
from 1024 px and an overflow menu below it, so the same setting lived in two places.

- The save indicator renders only for a failed save. A save in progress or a save that landed
  shows nothing. The failure is still announced once by its error toast, and the indicator stays
  no live region, so the inventory above is unchanged.
- The failed state is a danger strip directly under the header, not a control in the header
  row: a sentence that says the latest changes are not stored and a button that saves again,
  described by that sentence. Beside the plan switcher on a 360 px phone the failed button took
  the width the plan name and term need and cut both short; in its own strip every word wraps
  and shows in full, and the strip pushes the body down rather than covering it.
- Because the strip leaves as soon as a retry starts saving, a retry from its button or from
  the toast moves focus to the plan switcher trigger, never to the body. Both surfaces name the
  action the same way, บันทึกอีกครั้ง in Thai and Save again in English, so one action has one
  name.
- The overflow menu is present on every tier and is the one place the language is chosen. The
  header segmented language toggle is removed.
- Each language item shows its flag, drawn inline as SVG: the Thai flag for Thai and the United
  States flag for English. The flag is aria-hidden; the language name beside it is the item's
  accessible name, and the check mark with menuitemradio checked marks the current language, so
  neither the flag nor colour carries the state alone. The menu keeps its keyboard model: roving
  focus with the arrow keys, Home and End, Escape back to the trigger, and Tab out.
- Alternatives considered: a flag only header button that switches on press, as the redesign
  mockup drew, was rejected because the header still spends a slot on a rarely changed setting
  and a flag alone does not say what pressing it does. A two letter code beside the flag was
  rejected as redundant with the language name the menu already shows.
- Owner decision, 2026-11-22. The owner confirmed that the language choice in the overflow menu
  shows the flag with the language name, as the items above draw it. The flag stays beside the
  name, never in its place.

## Amendment, 2026-11-20: the coach mark live region

The search page coach mark of ADR-0072 adds one polite region, and
`src/features/shell/liveRegions.test.tsx` lists `features/onboarding/CoachMark.tsx` with it.

- `CoachMark` owns one sentence that says where the planner is and what it does, read once as the
  coach mark appears. The region is mounted empty from the start and carries the panel language in
  `lang`, since it sits outside the overlay root. The dialog's own name, the callout, is read as
  focus moves into it, so the region does not repeat it.
- It never coexists with the entry toast region speaking, since on the search page the coach mark
  takes the toast's place, and it never speaks while the panel is open.

## Amendment, 2026-11-20: the query chip and the icon filter row

Owner feedback on the redesign named three problems at the top of the catalog. The edit
search control was text heavy and did not say what pressing it would do. The head took about
475 px of a 390 by 844 phone before the first card, and the course count showed in four places:
the sheet header, the bar's status slot, the catalog summary line, and the group heading. A Thai
reader also wanted the English subject name, which the card showed only once it was opened.
Testing on phones found a blocked notice in the feedback strip stacked over the green toast of
the add before it, two answers to one press. The hard rule of the redesign holds throughout: no
layout overlaps or clips text, and every label shows in full.

- The summary bar becomes a query chip. The whole chip is the one control that opens and folds
  the form. It shows the query name in full, wrapping rather than clamped, over a line with the
  term, the scope, and the busy text while the query runs, and a pencil tile says it can be
  edited; open, the tile turns to a chevron. Its accessible name is the edit action followed by
  the visible summary, so a voice command that speaks what the chip shows reaches it, and it
  keeps aria-expanded and aria-controls. The chip row stays the focusable region that takes
  focus when a search is accepted or retried.
- The data time leaves the bar text. It names the refresh beside the chip in a tooltip and
  describes it for assistive technology. Past the cache lifetime it also shows as a warn line
  under the chip with a warning sign, since that is when the refresh is worth pressing. The
  rerun after a reload keeps its visible text and stays the same element as the refresh.
- The course count shows once in the catalog column, in the summary line under the filters,
  which still reports the sections and the merged duplicates that section 6.3 of the brief
  requires. Each figure leads with an icon and keeps its unit word, since a bare number does
  not say what it counts. The chip and the sheet header no longer repeat it, and a group
  heading shows its own count only when that count differs from the summary line: under
  several headings, or when a filter narrows the one heading. A single heading result such as
  a category search therefore shows the figure once. The counts on the
  bottom nav, the header sheet toggle, and the edge rail stay, because they label controls that
  bring the catalog into view from outside it.
- The filter row is one line: the text field, then icon buttons for the filter popover, the
  sort, and expand or collapse all. The facets themselves, day, credit, hide full, hide
  conflicting, hide unscheduled, and open to my curriculum, stay in the popover. Each icon
  control is named for assistive technology and shows its name in a tooltip on hover and on
  keyboard focus. The filter icon is followed by a badge counting the facets in use, set beside
  the icon rather than over it, and its name reads the count. The sort is the same select only
  combobox drawn as an icon, named by its label and the chosen order. The text field drops its
  visible label; the search glyph and the hint name it for the eye and the label names it for
  assistive technology. Since the hint is then the only visible name, it is kept short enough
  to show whole at 360 px beside the facet badge in both languages, which was measured in the
  built extension because a placeholder is not a text node the layout spec can see. Active
  facets still show as removable chips under the row.
- A course card shows the other language's name as a secondary line under the primary name,
  in muted ink, wrapping and never clamped, on a collapsed card as well as an open one, as
  section 6.7 of the brief asks. It describes the card toggle after the primary name and the
  credits name it. Because the title no longer clamps, the open body no longer repeats the name.
- One outcome shows at a time. A strip notice, a blocked reason, a cross term switch, or a
  hint, dismisses the ordinary toast on screen, and a toast that arrives clears the strip
  notice. The stores are linked by subscription so the later write wins even inside one
  handler. The undo toast is left alone, since it holds the only way back from a removal, and
  the screen reader only add line is not a visible notice. No live region is added or removed,
  so the inventory above is unchanged.

Alternatives considered: the one line query name with an ellipsis that the redesign mockup
drew was rejected under the hard rule, and the chip wraps instead. A badge laid over the
filter icon, as the mockup drew, was rejected because it covered the glyph it counts. Dropping
the merged duplicates figure along with the repeated counts, as owner item 12 suggested, was
rejected because the brief keeps it as the visible value of the dedupe; it now shows once. A
row of separate icon toggles for each facet was rejected because six toggles do not fit a 360
px row beside the field, and the popover already groups them with their labels. Keeping the
English name inside the opened body only was rejected because the request was to read it while
scanning the list.

## Amendment, 2026-11-20: the suggestion carousel position

The plan suggestion dialog shows one suggestion per slide (ADR-0054, amendment of 2026-11-20), and
`src/features/shell/liveRegions.test.tsx` lists `features/planner/SuggestionCarousel.tsx` with one
polite region.

- The carousel owns the position line between its chevrons, "ตัวเลือก 2 จาก 3" ("Option 2 of 3"),
  read when a swipe, a chevron, a dot, or an arrow key changes the slide. The line is visible and
  atomic, and it is mounted only while there is more than one suggestion to page.
- No existing owner can carry it. The dialog is modal, so the status announcer and the toaster are
  hidden while it is open, and the dialog's loading status unmounts once the search settles. The
  section comparison sheet keeps its own scoped node for the same reason.

## Amendment, 2026-11-20: the clipped text sweep

The owner rule of the redesign is that no layout overlaps or clips text: every label shows in
full, a Thai label wraps rather than ending in an ellipsis unless an explicit control reveals the
rest, no chip sits over text, and no fixed height cuts a line. Specs had guarded it one region at
a time, the status row, the coach mark, the export blocks, so a cut on any other surface reached
the build unseen. A sweep now guards the whole panel.

- The end to end spec `text-fit.debug.spec.ts` walks every main surface in the debug build at
  360, 390, 768, and 1366 px, in Thai and in English: the launcher, the coach mark, the welcome,
  the header and its overflow menu, the plan switcher with its list, create, rename, and import
  error views, the three search tabs, the query chip, the catalog collapsed and open with the
  longest Thai names and the longest teacher list in the fixtures, the filter popover and the
  sort list, the timetable in its day and week views, the block details, the status row, the
  feedback strip, the drag reason card, the suggest dialog at its first and second carousel
  option with every subject group open, the export page at each template with its display
  options, the updates dialog, and the undo toast. On each
  it fails on a text leaf that a box cuts, read as a box that hides its overflow and holds more
  than it shows or a line that runs past its edge, on a label half hidden in a row that scrolls
  sideways only, and on two text leaves that draw over each other. Each line is read at its line
  box height, since the ascent and descent of a Thai face run past a tight line box without any
  ink being cut. A text a scroller holds is read by scrolling and is not cut, and a sticky or
  fixed layer, such as a heading the list scrolls under, is compared only with its own leaves.
- Its exceptions are listed in the spec with their reason, and each has an explicit control that
  shows the whole text: a teacher, condition, or remark line resting as one line beside its
  expand control, a long plan name in the header trigger, which opens the plan list that wraps
  every name whole, and the neighbouring export template slivers, which the pager brings whole
  into view. The spec stays in the suite, so a regression on any surface fails it.
- Its scope is the resting layout, the panel as it shows with no layer opened: there no text may
  overlap other text or be covered, at any width, in Thai and in English. A layer the student
  opens, a menu, a popover, a dialog, or a sheet, may cover the page behind it while it is open.
  Behind such a layer the sweep fails only on a line the layer's edge cuts, as the amendment of
  2026-11-21 on opened layers records, and the layer's own text is held to the resting rule.
- The fixes it drove: the section teachers move onto the shared one line clamp with a Teachers
  label and a Show all teachers control, the exam note wraps, the search tabs wrap a long name
  such as Subject category in place of scrolling it out of view, plan names and their summaries
  wrap in the plan list, the block detail subtitle and the unscheduled shelf names wrap, the plan
  switcher keeps a minimum width that holds the longest term line whole, and the drag overlay is
  kept inside the window, so the reason card slides back from an edge rather than running past
  it. The clamp reads the content box dnd-kit measures for the overlay, and on a touch drag it
  applies the lift of ADR-0058 first and clamps the lifted box, so a card raised above a finger
  near any edge stays whole too; a touch spec checks each window corner. The debug build's
  diagnostics trigger no longer floats over the open panel; it waits on the host page and moves
  into the header overflow menu while the panel is open.
- The detector has known limits. It reads a line at its line box, not its ink, and allows up to
  half the gap between the glyph box and the line box, so a tight single line that hides its
  overflow can still cut a Thai upper tone mark or lower vowel inside that band unseen. A leaf
  in a fixed or sticky layer is compared only with its own layer, so a floating chip, strip, or
  toast drawn over static text is not caught here and needs a check in that surface's own spec.
  The debug diagnostics trigger sits outside the swept panel region, so its move into
  the header menu is guarded by a unit test.

Alternatives considered: a per surface assertion in each feature spec was rejected because a new
surface would start unguarded; one walk names every surface in one place. Reading text through
the scroll size of its nearest box alone was rejected because a cut by an outer box, such as the
tab row, does not show there. Raising the header height so a plan name could wrap was rejected
because the header row stays one line on every width.

## Amendment, 2026-11-21: the docked strip takes room only while it shows

On the docked tiers the feedback strip reserved a 1.75rem band at the top of the grid column so a
notice never shifted the grid. A conformance review found that band, with the column gaps around
it, read as an empty strip of about 50 px between the tabs and the time axis on every visit, while
a notice shows only for a few seconds after a blocked add, a cross term add, or a missed drop. The
strip now holds only its live region at rest, with no height and a negative margin that cancels
the column gap after it, and takes its height back while a notice shows, so the grid moves down
for the length of the notice and returns. The live region stays mounted throughout, so a spoken
add confirmation, which never shows, never moves the grid. An overlay over the top of the grid was
rejected because it would cover the hour labels, against the owner's rule that no layout hides
text.

## Amendment, 2026-11-21: nothing cut at the foot or the head

A conformance review against the owner rule found text that the sweep let through. Each fix
below supersedes the earlier text it names.

- A reopened search form shows whole from 640 px up. The 12rem minimum the results kept under
  an open form, from the amendment of 2026-11-06, is withdrawn: at 768 and 1366 px it cut the
  curriculum form short, so the class year box lost its foot and the submit row sat out of view
  with nothing marking that the form scrolled. The form now takes the height it needs and the
  results take what is left. Only a window too short for the whole form makes it scroll, and
  then the submit row pins to the scroller foot with its divider, as on the phone, so the action
  stays in view and the divider marks that more lies above. Keeping the minimum with a scroll
  shadow was rejected, since a field would still be cut through its box at the scroller edge.
- The plan name in the header trigger shows whole. The trigger had a 16rem cap and cut the name
  to one line with an ellipsis even at 1366 px, where the header had room to spare. The cap is
  gone, so the name takes the room the header leaves it on one line at the body size. Where one
  line cannot hold it, the name wraps onto two lines at the next step down the type scale, then
  at the step below, each sized with the term line under it so the trigger stays inside the
  header row, which still never grows. Only a name longer than two lines of the smallest step
  can hold, far past any default or suggested name, is shortened with an ellipsis, and the
  trigger it sits in opens the plan list, which wraps every name whole. This replaces the
  rejection, in the clipped text sweep amendment, of wrapping the name: the row keeps its
  height and the name wraps inside it. The default name a suggestion creates, such as "Plan
  2/2569 Balanced", fits whole at 360 px once it may wrap, so it keeps its wording.
- The export template dots carry no hover tooltip. A dot's tooltip opened on top of the caption
  under the stage, which names the same template, so only a tail of the caption showed while
  the pointer rested on a dot or a keyboard move focused one. Each dot keeps its name for
  assistive technology. Placing the tooltip under the dots was rejected, since the panel foot
  leaves it no room and it flipped back over the caption.
- The suggestion carousel arrows carry no hover tooltip, as the dots do not. The position line
  between the arrows names the page, and each arrow keeps its name for assistive technology.
  No side of an arrow is free: above, the next arrow's tooltip covered the dialog's close
  button; below, the previous arrow's would cover the option heading; and toward the position
  line, which at 360 px is a short row with the line centred, either tooltip covered the first
  or last word of the line. Opening the tooltips toward the line, which held from 768 px up,
  was rejected for that reason, and a tooltip only on the wider tiers was rejected because the
  arrows would then behave differently by width for no gain the line does not already give.
- No toast sits over the plan status row. A failed save showed both its strip under the header
  and an error toast at the panel foot, and the toast hid the credits, the subject count, and
  the clash line of the status row. The strip is now the one place a failed save shows, and it
  stays no live region. The persistence hook hands the failure to the status announcer through
  the status store, so the panel's one status region speaks it once, as the toast did, a run of
  failing autosaves stays quiet, and the live region inventory is unchanged. A live region of
  the strip's own was rejected, since the strip comes and goes with each autosave while saves
  keep failing. This supersedes the error toast and its retry in the amendment of 2026-11-20 on
  the quieter header. Any other toast makes room: the toast region reports the height of the
  toast on show, and the plan region ends in a band of that height while it shows, so the status
  row, the export page caption and dots, and the phone sharing toolbar rise above the toast. The
  toast region therefore rises over the phone foot only for the bottom nav in edit; on the phone
  export page it rests at the foot and the toolbar rises above it. Lifting the toast over the
  status row was rejected, since it would then cover the timetable blocks.
- The clipped text sweep passed while all of the above held, so it now reads more. A text leaf
  fails as covered when the element a press would reach at three points across its line, or just
  inside either end of it, is neither its own element nor around it, which catches a toast, a
  tooltip, or a card laid over text; this replaces the known limit that a floating layer over
  static text needed its own spec. A layer that lets presses through is drawn for looks and is
  read through, a row pinned inside the leaf's own scroller is cleared by scrolling, and a dim
  drawn on purpose, such as the product tour's, is named as see through. The walk now reads the
  timetable with the undo toast up and after a failed save, the export page with a copy toast up
  and with the pointer resting on each template dot, the suggestion carousel with the pointer
  resting on each arrow, the reopened curriculum form, which must not scroll at the sweep
  height, and every product tour step, with the phone bottom nav read under the dim. Each
  exception now names the control that shows the whole text, which must be on show for the leaf
  to be excused: the expand control beside a clamped line, the plan switcher trigger for a plan
  name past two lines of the smallest step, and the pager dots for a template sliver.

## Amendment, 2026-11-21: the section add button and the two line rest

A conformance review of the redesign found two catalog patterns left from 1.4 that the owner had
asked to leave behind.

- The add of a section row is a compact button, a white face with a hairline edge, the accent
  plus, and the short add word, in its own column at the top right of the row, in place of the
  full height primary-soft rail on the trailing edge that ran an orange wash down the catalog.
  Its column is shrink-0 and the row body beside it stays min-w-0 and wraps, so the button never
  overlaps text at any width. It keeps every section state: an addable or conflicting open
  section adds, a conflicting add still routes to the blocked feedback strip with the conflict
  callout as its description, a full, closed, or different term section keeps the add disabled
  with the reason in the row body and its description, a duplicate or added section has none,
  and the different term switch action and the drag grip are unchanged. Its accessible name
  starts with the visible word and names the subject and section.
- A teacher, condition, or remark list rests at two wrapped lines rather than one. Collapsed, the
  lines share one item that keeps their breaks and is clamped at two lines; the expand control
  shows only when the clamp hides text, read through the item's scroll height, or when more than
  two lines are given, and a list that fits shows whole with no control. This amends the one line
  rest of the clipped text sweep amendment above; the sweep exception still names only a
  collapsed list beside its expand control.
- The unchanged group of the updates dialog folds behind a button disclosure with the panel's
  chevron instead of a native details element, whose browser triangle matched no other
  disclosure.

Alternatives considered: an icon only add was rejected because the plus alone reads less clearly
than the short word beside it. Keeping the one line rest and widening the column was rejected
because no width holds a long Thai teacher list on one line at 360 px. Placing the add in the
badge cluster of the first line was rejected because the cluster wraps with the badge width, so
the add would move from row to row.

Owner decision, 2026-11-22. The owner confirmed the two line rest: a teacher, condition, or
remark list rests at two lines, and a show all control beside it reveals the rest. Showing every
line at rest was not chosen, since a long teacher list would push the next section rows out of
view, and the one line rest stays retired.

## Amendment, 2026-11-21: the hide control is an icon button

The docked header's hide control was a text row, the icon cell followed by "ซ่อนรายวิชา". The
redesign asks for icons and less text, and the mockup draws the collapse as an icon alone. The
control is now an icon button: the same 44 px icon cell at the leading edge of the 48 px row, so
it still centres on the rail icon, with "ซ่อนรายวิชา" or "Hide courses" as its accessible name and
as a tooltip on hover and keyboard focus, placed to its right so it never covers the plan view
tabs. Focus moves are unchanged.

## Amendment, 2026-11-21: no exception left for the plan name and the template slivers

A second conformance review found four places where text was still cut or half hidden, and a
fifth where controls skipped the touch target. Each fix supersedes the text it names above.

- The plan name in the header shows whole at every width. A name that two lines of the second
  type step cannot hold now wraps at the smallest step onto every line it needs, in place of the
  two line clamp with an ellipsis that the amendment "nothing cut at the foot or the head" kept
  as a last resort. The header is now at least 56 px high, or 48 px on a short viewport, rather
  than exactly that, so the row grows with a name past two lines; the trigger pads a little at
  that step so its lines do not meet its edge, with a hair of margin that keeps it clear of the
  header edges, and the controls stay centred on the row. A name on one or two lines keeps the
  header at exactly its minimum height. The body below takes the height left, so nothing under
  the header is covered. The sweep exception for the clamped name is removed. Since the header
  now grows with the name, a typed or imported name is capped at 100 characters, so a name never
  fills the screen: the name form shows a live count and keeps save off past the cap, and an
  import lists a longer name as a field issue and commits nothing. A storage read keeps the name
  open, so a plan named before the cap still loads and shows whole, and its rename keeps save
  off until the student shortens it. Clamping the header again past a set height was rejected,
  since it cuts the name this amendment shows whole.
- The export stage shows the selected template alone, recorded in the ADR-0045 amendment of the
  same date, and the sweep exception for the template slivers is removed.
- The phone search form carries the clear search inside its pinned action row, under the
  submit, so the pinned row is always the last thing in the form scroller. The clear search had
  followed the row in the flow, so on a reopened English form at 360 and 390 px it rested half
  cut at the scroller foot above the bottom nav, with nothing marking that the form scrolled. The
  pinned row drops its top margin and pads tighter so the form still fits above it at rest. The
  sweep now reopens the phone form under the bar of a search and fails on any control resting
  after the pinned row or on a pinned row the scroller cuts. Padding the scroller by the nav
  height was rejected: the nav is in the layout flow under the pane, not over it, so the cut was
  the scroller's own foot.
- A collapsed teacher, condition, or remark line paints the text past its second line
  transparent. The clamp clipped its box at the foot of the second line, but a stacked Thai tone
  mark of the hidden third line rose into that foot and showed beside the ellipsis. The split
  point is found from the laid out character boxes and leaves the layout, the ellipsis, and the
  accessible text unchanged. A taller line height was rejected, since no fixed room holds every
  stack of marks. The sweep now fails on any line clamp that paints a line past its count, read
  before the exceptions, since the expand control excuses the text a clamp hides, not the ink
  it lets show.
- The different term switch above the catalog, the retry of the search options, the back
  control of a rejected import, and the export and close of the storage notice take the shared
  touch target, as the same switch in a section row already did. A touch spec checks the
  clear search, the banner switch, and the import back at 44 px on the phone and the tablet.

## Amendment, 2026-11-21: an opened layer cuts no line at its edge

A third conformance review found a tall block detail ending across the status row: at 1366 px
the detail of a section no longer listed ran to the viewport foot, and its bottom edge cut the
tops of "No conflicts" and each day's hours. A layer the student opens on purpose, a popover, a
menu, or a sheet, may cover the page behind it, but it must not cut a line at its own edge where
room exists to avoid it. The sweep had read each popover only inside itself, so it never saw the
line under the edge. The review also found the plan name field showing a long name in part.

- The anchored block detail stands as a column of the plan area, the timetable and shelf between
  the view tabs and the status row. It still opens beside its block and flips to the other side
  where this one has no room, but its foot now meets the plan area's own and its top meets the
  foot of the timetable's pinned head, the row of hour labels, or of day labels in portrait. So
  neither edge lands part way across a line of the timetable or of the status row, and its side
  never meets an hour label: a label is centred on its gridline, and a detail 6 px from a block
  that starts on that gridline would split it, so that 13:00 read 3:00. A detail taller than the
  column scrolls in its body between the pinned heading and actions. The column's own size is
  watched as well as the block's, so a toast band that lifts the status row keeps the detail's
  foot above it. The shared popover recipe takes the column and its head as an option; every
  other popover keeps its viewport sizing. Starting the column at the plan area's top was
  rejected for that split hour label. Capping the height to the space above the status row and
  shifting the node up was rejected: the sweep then found its foot across a Friday block's name
  at 768 and 1366 px and its top across a Monday block's time, since a node of its own height
  ends wherever its content does. Flipping the detail above or below its block was rejected
  because the timetable rows leave no row free of text.
- The sweep reads the page behind an opened layer. In this reading a line the layer covers whole
  passes, and a line its top or bottom edge cuts fails: each line is probed near its top and
  near its foot at the same points across it, and a line that shows at one and is covered at the
  other at two points or more is cut. A split at one point alone is the layer's rounded corner
  over a line's end. A line covered top to foot at some points and on show at others is cut by
  the layer's side edge and fails as well, since what shows reads as another word or another
  time. The one region a side edge may cut is named by the caller as beside the layer's anchor:
  behind the block detail it is the timetable blocks, which a layer opened beside its block has
  no room to avoid. An axis label, the status row, the toolbar status, and a template chip have
  no such excuse. The scroller rule for a fixed layer over a list's end does not apply behind a
  layer the student opened. The walk now reads the panel behind the block detail, behind the
  detail of the missing section the moved fixture leaves, which it also reads whole on its own,
  and behind the display options sheet of the export page below 640 px; from 640 px up those
  options became an inline panel the sweep reads as part of the page (ADR-0027 amendment of
  2026-11-21).
- The plan name field, in create and rename, is a text area that grows to the lines the name
  needs, in place of a one line input that showed a long name scrolled to its end with its first
  glyph cut at the field edge at 360 px. It keeps the behavior of a one line name: Enter saves,
  a line break typed or pasted becomes a space, and the 100 character cap and its live count are
  unchanged. Since a text area is announced as multi-line, its description adds that Enter
  saves, and a phone keyboard offers Done in place of a return key. A field cannot show its
  value as a text leaf of the page, so the sweep checks that the field scrolls neither down nor
  sideways once a long name is typed. A wider field was rejected, since no width holds 100
  characters at 360 px, and an ellipsis was rejected because it hides the name the student is
  editing.

Owner decision, 2026-11-22. The owner confirmed the rule this amendment applies: a layer the
student opens, a menu, a popover, a dialog, or a sheet, may cover the page behind it while it is
open, and the resting layout, with no layer open, must never overlap text. Dialogs are named with
the other layers, since a modal dialog covers the panel by design and closes back to a resting
layout the sweep reads in full. The clipped text sweep amendment above now states this as the
sweep's scope.

## Amendment, 2026-11-22: a toast floats and moves nothing

The owner reported a layout shift at 1366 px: a move toast with its undo action made the status
row and the timetable jump up as it appeared and back down as it left. The band of the 2026-11-21
amendment above on nothing cut at the foot or the head caused it. The toast region reported the
toast's height and the plan region ended in a band of that height while a toast showed, so every
toast resized the plan area, and on the phone export page the band lifted the whole sharing
toolbar. The owner's rule is now that a toast never causes layout shift. This supersedes the
band, the clause of that amendment that any other toast makes room, and its rejection of a toast
lifted over the status row.

- A toast is transient and is read like a layer the student opened, next to the owner decision on
  opened layers above: while it shows it may cover the page behind it, here the bottom of the
  timetable, and the resting layout with no toast must never overlap text. Nothing makes room for
  a toast, so the status row, the timetable, and the sharing toolbar keep their boxes before a
  toast shows, while it shows, and after it leaves.
- The toast must still cover none of the controls along the panel foot. The plan region names its
  foot element, the status row in edit or, below 640 px, the sharing toolbar of the export page,
  and the toast region floats above it: the panel padding, the foot's height, and an 8 px gap,
  plus the 56 px bottom nav on the phone in edit, above the bottom safe area inset. The foot is
  measured by its own box at rest and never by the toast, so a toast that shows or leaves changes
  nothing the offset reads. With no foot named, over the phone catalog pane, the region keeps its
  72 px rise above the nav, and from 640 px up on the export page, where the toolbar heads the
  poster, it rests at the foot over the stage. While a bottom sheet is open the region drops to
  the foot, since the sheet covers the nav and the plan foot.
- A bottom sheet makes no room for a toast either. It used to end in an 80 px band while a toast
  showed, which grew the sheet or, at its height cap, lifted its footer of actions, so it moved
  the same way. Its body now keeps that room at rest: above a footer, a bottom padding and scroll
  padding of 80 px, the 8 px gap over the footer, a toast up to 64 px, and a gap; without one, the
  16 px foot offset or the bottom safe area inset where larger, plus 72 px. A sheet with a footer
  names it, measured by its own box, and the toast region floats its height plus 8 px above the
  sheet's foot, so a toast covers none of the sheet's actions; without a footer the region rests
  at the foot over the padding. The sheet's box, its body, and its footer are then the same
  before, while, and after a toast shows, and the last item of the body scrolls clear of a toast.
  A sheet whose action answers with an undo toast still adds the toast region to its focus trap,
  so the undo stays reachable by Tab. Keeping the band only for a sheet below its height cap was
  rejected, since the sheet would still grow, and so was laying the toast over the footer, since
  it would cover the actions the student came to the sheet for.
- The timetable scroller, and the selected and summary views, end in a bottom padding and scroll
  padding about as tall as a toast, 60 px or 64 px under a coarse pointer where its controls take
  the touch size. The padding is present at rest, so a toast that appears changes nothing, and the
  last row can always be scrolled clear of a toast, as can a block brought into view. Where the
  week fills its scroller, the rows share the height above the padding, so the toast floats over
  the padding rather than a row.
- The unscheduled shelf sits between the timetable and the status row and scrolls with neither,
  so no padding can bring its rows clear of a toast. While the shelf shows, the foot is measured
  from the top of the shelf to the foot of the status row, so the toast floats above the shelf,
  over the padding at the end of the timetable, and the shelf keeps its box and its remove
  controls stay uncovered.
- Below the dock the feedback strip floats above a toast, since its chips are the next step. Its
  fixed rises assumed the toast at its old offsets, so a toast lifted over the status row would
  cover the strip and, on the phone, its reveal action. Wherever the toast floats over a named
  foot, the strip now rises from the toast's own offset by the 72 px it keeps for a toast of up
  to 64 px and a gap; its fixed rises still apply where the toast keeps its fallback offsets.
- Lifting the status row above the toast was rejected, since that is the shift the owner reported,
  and so was measuring the toast to place it, since any offset read from the toast moves with it.
- The clipped text sweep reads a toast in three parts: the toast itself must show whole, it must
  cover none of the status row, the phone bottom nav, or the sharing toolbar, and the page behind
  it is read with the toast seen through. A new walk measures the boxes of the status row, the
  timetable scroller, and the export toolbar and stage before a copy toast, an undo toast, and an
  export copy toast show, while each shows, and after it leaves, at 360, 390, 768, and 1366 px in
  Thai and in English, and fails on any move. At 360 and 390 px it also opens the block detail
  sheet, scrolls its body to the end, and copies the subject id from it, and fails if the sheet,
  its body, its footer, or the copy action moves, or if the toast covers the footer or the copy
  action.

## Amendment, 2026-11-22: the change section instructor line, an owner approved ellipsis

The owner asked that a change section choice (ADR-0068 amendment of the same date) keep its
instructors on one line, ending in an ellipsis when they do not fit, and that the line scroll
sideways to read the rest. This is an owner approved exception to the rule that no text rests
behind an ellipsis without an explicit control, and it is the only one. The line keeps the rule's
intent in other ways: while names lie past its end, a fade over its last few glyphs and an
ellipsis close its text row; the line scrolls under them by touch, trackpad, or the thin
scrollbar a mouse sees; and a line that holds more than it shows is a named region and a tab stop
in the scrollable region pattern, so the arrow keys scroll it, and its focus ring hides the fade
so the ring shows whole. Scrolled to its end, the line drops the fade and the ellipsis. The full
list is always in the page, and the choice names it as its description, so a screen reader reads
every name whatever the scroll. The list carries no name of its own, since a browser reads a
referenced element's name in place of its text when it computes a description; the walk below
asserts the description in Chromium, because jsdom computes it differently. Each region is named
for its choice, such as Instructors of section 941, so the landmarks of a long list stay apart.

The clipped text sweep names the exception in its list with this reason: a leaf of the
instructor line is excused only while its line is the named, focusable scroller, the explicit
control that reveals the rest. A new walk opens every change section list of a three subject
plan in the selected view at each width and in both languages, one subject of which has 21
instructors, three meetings, and no room, and one of which is a pair. A line that fits is no
region and no tab stop, and its text must show whole like any other.

Wrapping the instructors onto further lines, as the catalog rows do behind Show all
instructors, was rejected here because the owner asked for one line per choice so the choices
stay short enough to compare at a glance on a phone.

## Amendment, 2026-11-22: the filter days share one row

The owner reviewed the 1.6.0 gate on a phone and found the day choices of the filter popover on one
row except Saturday, which wrapped to a row of its own. Under a coarse pointer each day chip took
the 44 px width minimum, and seven chips with their gaps needed 332 px, more than a 360 px phone
leaves the popover. The days now sit in a grid of seven equal columns, so the week shares one row
at any width in Thai and English. Each chip keeps the 44 px touch height and gives up only the
44 px width, holding the 24 px minimum of WCAG 2.5.8, as the timetable day chips of ADR-0049 do.
A narrower chip label was rejected, since the day abbreviations are already the shortest forms the
dictionaries carry.
