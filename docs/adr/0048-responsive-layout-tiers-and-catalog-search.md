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
  from the header toggle.

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
