# 63. Entry toast and launcher attention cue

Status: Accepted
Date: 2026-11-06

Amends brief section 8.2, which names one toast pattern for global action feedback, and the live
region inventory of ADR-0048. Builds on ADR-0062, which adds the toolbar action, the handshake and
the install welcome.

## Context

A student who lands on a regis page has no sign that the planner is there beyond a small launcher
in the corner, and a student who already has a plan has no reminder of it when they return. The
owner asked for a short prompt on page load that names what the planner can do from where the
student is, with a way to stop it, and for a launcher that draws the eye until it is first used.

Section 8.2 fixes one toast pattern for actions whose outcome is not otherwise visible, and
`toastStore` implements it: one toast at the bottom centre of the panel, an auto dismiss near four
seconds, priority for the undo toast, and every toast cleared when the panel closes. A prompt
anchored to the launcher needs the opposite on each point. It must sit beside the launcher, live
long enough to read and act on, show only while the panel is closed, and never compete with undo.

The host is a single page application, so a hash change is frequent and is not a new visit. The
install visit of ADR-0062 can also show the welcome, and a prompt beside it would stack two
surfaces asking for the same first action.

## Decision

Entry toast. The entry toast is a prompt anchored to the launcher, not action feedback, and it is
not a precedent for new toasts: future action feedback still goes through `toastStore`. It is its
own component, `features/onboarding/EntryToast.tsx`, with its own polite live region. The region
is mounted empty from the start, so the announcement fires when the text arrives, and it carries
the panel language in `lang`. Visually it is the same pattern as the toast of section 8.2: the same
tokens and border variants, the `.kcp-toast-enter` entrance with its reduced motion path, the same
close button, and the same hover and focus hold, shared through one hook rather than copied.

Timing. The toast shows at most once per document. A 2000 ms delay starts only after the plan load,
the onboarding read, the worker handshake and the welcome decision have all settled, and only while
the document is visible. It auto hides after 8000 ms, and hover or focus inside it pauses that
timer. The close button and Escape hide it for the current document. A do not show again action
writes `entryToastOptOutAt` to `kcp:onboarding`.

Gating. The toast never shows on `hashchange` or `popstate`, never while the panel or the welcome
is open, and never after opt out. It never shows in a document that found the welcome pending at
load, whether or not that document won the welcome claim, in a document that showed the welcome,
or in a document that applied a requested open. Opening the panel hides it for good. These rules
mean the install visit shows the welcome and no toast.

Content precedence. The toast says one thing, chosen in this order: unreviewed plan changes, then
the result route, then an active plan with subjects, then an empty active plan, then no plan. The
result route applies only when the hash at mount and at show time is the same result route that
maps to a search, and a later `hashchange` hides a route offer that is showing. Every action opens
the panel through one `openPanelAt` entry point. The route action hydrates the persisted search,
overlays the prefill read from the route, which reads the host URL and never changes it, and runs
the search as the student's explicit action, so it costs one request under section 4.7.

Launcher. The launcher becomes a fully rounded pill in the strong primary colour with the icon and
the label. On hover and focus it lifts by 2 px through a transform only, since section 8.2 keeps one
shadow level. A ring pulses twice per page load until the first panel open, recorded as
`panelFirstOpenedAt`: a 200 ms delay, then two pulses of 900 ms, ending as the toast appears. The
ring grows by a fixed 8 px on every side rather than by a scale factor, so it stays inside the 20 px
edge offset and clear of the toast at every width; a scale on a wide pill crossed that offset. The
ring starts only once the welcome is not open, and it is skipped when stored plans exist, so
returning students are not prompted. Under reduced motion it is a static ring for 2000 ms, removed
by a `steps(1)` keyframe with no movement. There is no badge on the launcher or on the toolbar icon,
by owner decision.

Placement. The launcher sits at right and bottom `max(20px, safe area inset)` with a 48 px minimum
height. The toast sits at right `max(20px, safe area right)` and bottom
`calc(max(20px, safe area bottom) + 60px)`, with a width of 20rem capped at the viewport width less
both side offsets, so it cannot cross the left inset on a narrow screen. Every node mounted directly
in the shadow root uses the host stacking level and stacks by mount order: launcher, entry toast,
overlay, diagnostics, toaster, then the welcome, which exists only while open. The overlay covers
the launcher and the toast, and the toast is hidden whenever the panel is open anyway.

Live regions. The inventory of ADR-0048 gains one node, the entry toast's polite region. It owns the
entry prompt and nothing else, so no outcome another region owns is read twice. The amendment to
ADR-0048 and the inventory test change together when the toast lands.

## Alternatives considered

Reusing `toastStore` was rejected. Its bottom centre placement, four second life, clearing on close,
undo priority, and outcome semantics each contradict what the prompt needs, and changing them would
change every existing toast.

Showing the toast on each `hashchange` was rejected. Navigation inside the host application is
frequent, so the prompt would become noise.

A cooldown timer across documents was rejected. Once per document is already rare in a single page
application, and a timer adds stored state with no gain.

A badge on the launcher or on the toolbar icon was rejected by the owner.

## Consequences

`src/features/shell/liveRegions.test.tsx` and ADR-0048 gain one entry when the toast lands.

A student who navigates inside the host application to `#/teach_table` after load sees no route
offer, by design, since the offer belongs to the page the student arrived on.

Opt out has no surface to turn the toast back on, since section 6.9 rules out an options page. This
is an accepted gap; a toggle in the panel menu is a possible later change.
