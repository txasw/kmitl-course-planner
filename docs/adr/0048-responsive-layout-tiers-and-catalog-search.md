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
