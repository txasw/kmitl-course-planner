# 74. First run product tour

Status: Accepted
Date: 2026-11-20

Builds on the install welcome of ADR-0062 and the onboarding record it introduced. Adds one node
to the live region inventory of ADR-0048. Shares the attention rules of ADR-0060 and the toast
pattern of brief section 8.2.

## Context

The welcome after install explains the planner in words and lists the three steps of a plan, but
it points at no control, and a student who presses Start planning lands on a panel full of
controls with no guide to which one comes first. The owner asked for a first run tour on the real
controls (feedback item 13) and decided that it starts after the student presses Start planning
in the welcome, that a student who installed before the tour existed sees it once after the
update, and that it can be opened again from the overflow menu (decision q8 A). The visual
reference is screen 07 of the redesign mockup: a spotlight cut through a dim on one control, a
small card with a progress bar, a short title, one sentence, Back, Skip and a full width Next that
keeps its place from step to step.

The panel lays out differently at each tier of ADR-0048. Below 640 px the catalog and the
timetable are separate panes behind the bottom nav, so half the controls of a tour are hidden at
any moment; on the medium tier the catalog is a modal sheet over the grid; on the docked tiers
the catalog column can be hidden. Some controls exist only in some states: the query chip only
after a search, the add buttons only inside an open course, the suggest action only for a
curriculum search in the plan's term, the day chips only on a narrow timetable.

## Decision

Steps. The tour has five steps in the order a plan is made: search, add a section, read the
timetable, ask for a suggestion, and export. Each step names the panel view it lives in and, in
order of preference, the controls it can point at, each with the sentence that fits that control:
the search step points at the query chip once a search ran and at the search tabs before; the add
step points at an add button of an open course, else at a course to open, else at the search
button; the timetable step points at the day chips of a narrow timetable, else at the timetable
tab, else at the bottom nav item; the suggest step points at the prominent suggest action in the
plan status row; the export step points at the header export button. Controls carry a `data-tour`
attribute, set through one helper in `lib/onboarding/tour.ts`, which also holds the steps as data.

Never a hidden target. When the tour opens it keeps the steps that have at least one of their
controls on the page, so a student with no curriculum search meets four steps and the count says
so. Before a step shows, the panel lays out the view the step lives in through the same store
writes the entry points use: the catalog pane or the timetable pane on a phone, the catalog sheet
open or closed on the medium tier, the catalog column shown or the plan on its timetable on the
docked tiers. The step then takes the first of its controls that is shown, outside every inert
subtree, laid out and not hidden by visibility, and scrolls it into view within its own scroller
inside the panel, never the host page. A step whose control does not show within a few frames is
left out and the count follows, so the spotlight never lands on a hidden element. When the tour
ends the panel stays in the view of the last step shown, with the catalog sheet, the phone pane or
the plan view as that step left them, rather than returning to the view the tour found. Focus
returns to the control that step pointed at, and restoring the earlier view would hide it again.

Surface. The tour renders into the panel node, above every layer of the panel. The spotlight is a
box 4 px around the control, ringed in the surface colour, and the dim is its spread, the ink at
56 percent through the `--kcp-scrim-tour` token: a scrim and not an elevation, as in ADR-0072. The
layer takes every press, so nothing under it changes while a step points at it: the target is
shown, not operated. The card carries a progress bar hidden from assistive technology, the count
"1 จาก 5" or "1 of 5", Back from the second step, Skip, the title, one sentence, and a full width
Next that reads Finish on the last step. Every label wraps; none is clamped.

Placement. The pure `placeTourCard` in `lib/onboarding/tourPlacement.ts` keeps the card along the
panel's foot, the thumb zone on a phone, so Next stays in one place while the spotlight moves. Only
when that place would cover the spotlight does the card move to the panel's head, and when a tall
spotlight reaches both, it goes beside the spotlight on the side with more room. The card clears
the device safe areas, measured from a probe that takes them as its offsets, fills a phone less a
16 px margin, and keeps a 380 px reading width on wider panels. The ordinary toast region and the
debug diagnostics trigger sit along the same foot, so both step aside while the tour is open; a
toast from before the tour is dismissed rather than returning stale, and a pending undo returns
with a fresh window when the tour ends.

Gating. The pure `shouldStartTour` decides. The tour starts on its own once per document when the
panel is open in edit, the onboarding record has been read, the welcome is closed, no dialog,
sheet, menu or popover holds the panel (the attention store of ADR-0060, so it waits for the
updates dialog that can open with the panel), and the record names no finished or skipped tour of
the current version. A short settle of 500 ms keeps it from landing on a panel still laying out
its first frame. After install that moment is the one Start planning opens; for a student who
installed earlier it is the first open after the update. The tour counts as an open surface
itself, so the updates dialog waits for it. A tour the panel's close cuts short records nothing,
so it is due again on the next page load.

Storage. The onboarding record gains an optional `tourSeen` object with the tour version, the
outcome, completed or skipped, and the time. It is validated by Zod and caught as a whole like the
other fields, so a record written before it existed reads as version 1 and needs no migration. A
replay that ends writes a newer mark, and the latest write replaces the stored one, like the coach
mark day of ADR-0072. Raising `TOUR_VERSION` shows a revised tour once more to every student.

Reopening. The header overflow menu gains a menuitem, "แนะนำการใช้งาน" or "Product tour", under
the language group and a separator. It starts the tour from the first step, returning to editing
first when the export page is open. When the tour ends a toast says it can be opened again from
the menu and offers to show it again, through the same path, so a replay from the export page
returns to editing too. The tour reads which steps the panel offers on the first frame after it
opens, once the edit workspace it may have returned to has rendered.

Accessibility. The card is a modal dialog labelled by its title and described by its sentence.
Focus moves to Next as the tour opens, Tab stays inside the card, and Escape skips. A view change
that pulls focus out of the card, as the catalog sheet does when it opens, returns it to Next. A
polite region inside the card speaks each step after the first, since Next keeps focus as the
steps change; it is the one node this ADR adds to the inventory of ADR-0048. When the tour ends,
focus moves to the control the last step pointed at when it can take focus, else to the panel, so
it never falls to the host page. Under reduced motion the spotlight moves at once instead of
gliding, and nothing else moves.

## Alternatives considered

A tour library was rejected. The panel lives in a closed shadow root with its own focus traps,
escape layers and layout tiers, and a library's own positioning and focus handling would fight
all three, while the bundle budget leaves no room for one.

Pointing at controls as they happen to be laid out, without switching views, was rejected: on a
phone half of the steps would point at a hidden pane, which the owner's rule forbids.

Letting the spotlit control stay pressable was rejected. A press would switch views or open a
dialog under the tour and leave the next step pointing at a changed panel.

Showing the tour inside the welcome, as a second page of it, was rejected. The welcome runs over
the host page before the panel exists, so it has no real controls to point at.

## Consequences

Every end to end context seeds the tour as walked, so a spec that opens the panel never meets the
spotlight; the tour specs clear the mark. A layout guard walks every step at 360, 390, 768, 1366
and 1440 px in both languages and fails when the card leaves the viewport, covers the spotlight,
lets any text overflow, or is covered at any point by another layer.

Two dialogs can share a name while the tour runs on the medium tier: the catalog sheet and the
search step are both "ค้นหารายวิชา". The tour's dialog is modal, so assistive technology meets
only the tour, and the specs find the card by its data attribute.
