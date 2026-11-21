# 72. Search page coach mark

Status: Accepted
Date: 2026-11-20

Amends ADR-0063 (entry toast and launcher attention cue), where the entry toast is the one prompt
on a visit and the launcher ring the one attention cue, and the live region inventory of ADR-0048.
Extends the type scale of ADR-0052 with two display sizes. Builds on the first run gating of
ADR-0062.

## Context

The owner reports that students on the host search form, `#/teach_table_selector`, still do not
notice the planner. The launcher is a small pill in a corner, the ring plays only for a student
with no plans until the first open, and the entry toast is a quiet card that speaks once per
document. The owner asked for a prompt that takes the student's attention at once every time they
arrive on the search form, with two ways out: try later, which keeps the ring as it is, and do not
show again today. The owner supplied a reference sketch made with an image generator, for the idea
only: the page dimmed, the launcher lit as a spotlight, a short burst of strokes beside it, a hand
drawn pointer from a large callout down to it, and an outlined white pill to dismiss.

The host is a single page application with hash routing, so arriving on the search form is either
a document load on that route or a host navigation that makes it active. The host runs Vue Router
in hash mode on `pushState` (ADR-0067), so its own navigation fires no `hashchange`, and `popstate`
fires only on back and forward. A content script cannot hook the page's `pushState`. The extension
renders only inside its own shadow root and never touches the host page, its styles, or its scroll.

## Decision

Surface. The coach mark is a layer of the content script UI, `features/onboarding/CoachMark.tsx`,
mounted before the launcher so the launcher stacks above it by mount order, and before the overlay
so the overlay covers both. It dims the viewport with its own fixed scrim, the ink at 78 percent,
and leaves a rounded hole 8 px around the launcher, ringed in the primary soft colour, so the
launcher stays lit and pressable. A large white callout, "ลองใช้ดูสิ" in Thai and "Give it a try" in
English, carries an orange underline stroke. A pointer stroke runs from the end of the callout to
just above the launcher and ends in an arrowhead, and three short orange strokes fan out from the
launcher's top right corner. Left of the launcher sit a white pill, "ลองภายหลัง" or "Maybe later",
and a quieter white text button, "ไม่แสดงอีกวันนี้" or "Not again today". The strokes are inline SVG,
hidden from assistive technology. The callout uses the semibold heading weight and the system font
stack, with no remote font.

Design system fit. Every colour is a token: the scrim is `--kcp-ink` at `--kcp-scrim-coach-strength`,
the strokes are `--kcp-primary`, the pill is surface on ink with the strong border, and the ring is
`--kcp-primary-soft`. The scrim is the spread of the spotlight hole's box shadow, which is a scrim
and not an elevation, so the one shadow level rule holds. The callout takes two new display sizes
on the pinned type scale, `text-xl` at 24 px over 36 px below 640 px and `text-2xl` at 28 px over
40 px from 640 px, with line heights that leave room for Thai marks. They exist for this callout
alone. White text on the scrim over a white page clears 4.5:1, which the token contrast suite
proves. The orange focus ring would sit on the dark scrim below 3:1, so a focused text button turns
into a white chip that carries the standard inset ring, and the pill is white already.

Layout. One grid is anchored to the launcher's corner. A spacer in its last column takes the
launcher's own box classes and face, invisible, so it covers the launcher exactly at every width
and in both languages without measuring the launcher; the spotlight and the burst hang off it. The
callout and the buttons sit in the first column. The buttons wrap onto their own lines on a narrow
screen, Not again today above and Maybe later level with the launcher, so nothing overlaps the
launcher or each other and no text clips. The pointer box spans the gap column and the launcher
column above the launcher, and the stroke is computed in its measured pixels by the pure
`lib/onboarding/coachMarkPointer.ts`, so the curve keeps its shape. An end to end guard checks at
360, 390, 768 and 1366 px in both languages that the callout, both buttons and the launcher lie
inside the viewport, do not overlap, are not covered by a stroke, do not overflow, and receive a
press at their centre. The debug only diagnostics trigger steps aside while the coach mark shows,
since on a phone it would sit over the buttons.

Gating. The pure `shouldShowCoachMark` in `lib/onboarding/coachMark.ts` decides. The coach mark
shows when the location hash is the search route, with or without a query, after the onboarding
read, the worker handshake and the welcome decision have settled. It does not show while the panel
is open or the welcome is open, in a document that found the welcome pending at load or applied an
open the worker requested (the same document suppression as the entry toast), after a dismissal in
the current visit, or on the local day the student chose not again today. A visit is the stretch of
time the route stays active: a navigation away ends it and hides the coach mark, and a navigation
back starts a new visit, so it shows again.

Route signal. The shared host route listener in `features/search/useHashRoute.ts` hears a
navigation by any of four read only signals: `hashchange`, `popstate`, the Navigation API's
`currententrychange` where the browser provides it, and a mutation observer on the host document,
since the router swaps its route view as it navigates. The Navigation API reports a `pushState`
made from the page's world to a listener in the content script's isolated world, which the end to
end specs prove in Chromium by navigating with `pushState` and no event on a replica page with no
route view to swap. The observer runs alongside it rather than only in its absence, so a browser
that exposes the API without delivering its events to a content script still hears the host; it
reports only a hash that moved, so the host's own rendering wakes no subscriber. One set of
listeners serves every subscriber and is removed after the last one. Nothing in it writes to the
host.

Dismissal. Maybe later, Escape and a press on the scrim hide it for the visit. Not again today hides
it and writes `coachMarkSnoozedOn`, the local calendar day as YYYY-MM-DD, to `kcp:onboarding`.
Pressing the launcher opens the panel and ends the coach mark for the visit, so closing the panel on
the same page does not bring it back. Escape is read on the shadow root, which also sees a press on
the launcher, and on the window for a press while focus sits on the host page; the host's own press
is never prevented.

Storage. The day is an optional field of the onboarding record, validated by `z.iso.date()` and
caught on its own like the timestamps, so a record written before it existed reads as version 1 and
no migration is needed. It is the one field that is not kept once: every writer stamps its own
today, so the latest write replaces the stored day. The coach mark stays quiet when the stored day
is today or tomorrow. A day one ahead comes from a clock moved back a little or a time zone crossed
after the choice, and keeping it honours the choice. A day further ahead was written under a clock
set far forward, so it reads as no choice: the coach mark shows, and the next Not again today
replaces it. Merging by the later day was rejected, because such a day would then outlive every
correct day after it and silence the coach mark until that date with no way for the student to undo
it. The cost is a choice made just before midnight in one tab and written after another tab wrote
the next day, which moves the day back and shows the coach mark once more the next day.

Precedence. On the search page the coach mark takes the entry toast's place. The store records that
the coach mark has shown in the document, and `selectEntryToast` returns nothing once it has, so a
document that loads on the search route with the coach mark due shows no entry toast. A toast that
showed on another route ends when the host navigates to the search page and the coach mark opens,
so the two never stack. With the coach mark snoozed for the day, or on any other route, the entry
toast keeps the behaviour of ADR-0063. The launcher ring keeps its rules and also waits while the
coach mark is open, as it waits for the welcome, so after Maybe later or Not again today it plays as
before for a student it applies to.

Accessibility. The coach mark is `role="dialog"` with `aria-modal="false"`, labelled by the callout.
The launcher, the action it points at, lives outside the dialog node, and the host page under the
scrim cannot be made inert without touching it, so a modal claim would hide the launcher from a
screen reader and promise an isolation that does not exist. Focus starts on Maybe later, and Tab
cycles through Not again today, Maybe later and the launcher, the only controls the scrim leaves in
reach. When the coach mark hides while focus is inside it, focus moves to the launcher, so it never
falls back to the host page. A polite live region, mounted empty from the start, says where the
planner is and what it does once the coach mark appears.

Motion. When motion is allowed the scrim and the copy fade in, the underline is revealed from the
left, the pointer stroke draws along its length after 150 ms, and the arrowhead and the burst pop
last, the arrowhead in place about its tip and the burst out of the launcher's corner, all within
about 650 ms, then everything holds still. Every duration and delay is a motion token. Under
reduced motion every part appears in place with no animation and the highlight is static.

## Alternatives considered

Growing the entry toast into the coach mark was rejected. The toast is once per document and its
content follows a precedence of its own; the coach mark is once per visit of one route and says one
thing, and folding the two together would change the toast everywhere.

A modal dialog with a copy of the launcher inside it was rejected. Two launchers, one of them fake,
would confuse both pointer and screen reader users, and the real launcher would still be covered.

Locking the host scroll while the coach mark shows was rejected. The read only rule keeps the host
page untouched, and the scrim covers the viewport at any scroll position.

Measuring the launcher with a resize observer to place the spotlight was rejected in favour of the
spacer with the launcher's own box and face, which matches it by construction.

Showing the coach mark only until the first panel open, like the ring, was rejected by the owner,
who asked for it on every arrival; Not again today is the student's control over that.

## Consequences

`liveRegions.test.tsx` and ADR-0048 gain one entry for the coach mark's polite region.

The end to end harness seeds a settled context with the coach mark snoozed through tomorrow, so
the specs that open the search page are not covered by it even across local midnight, and
`allowCoachMark` lets a spec meet it.

Not again today reaches other tabs only when they next load. A tab reads the onboarding record
once, at load, and does not follow later writes, so a tab already open when the student chose it
in another still shows the coach mark on its next arrival that day, where either choice settles it
again. Following `storage.onChanged` for the record was left out: the other onboarding fields are
read once per document too, and one live field would make the record half live.

A student who uses the planner every day sees the coach mark on every arrival on the search page
until they choose Not again today, and again on the next day, by owner decision. The owner can
revisit whether a returning student with stored plans should see it.

## Amendment, 2026-11-21: the launcher ring after the coach mark is put off

The owner asked that the launcher keep blinking after the student picks Maybe later or Not again
today, for every student. Until now the ring followed ADR-0063 alone, so after either choice it
played only for a student who had never opened the panel and had no stored plans, and a returning
student, the student the coach mark speaks to most often, saw nothing move at all.

Decision. The ring is now due in two cases. The first run case of ADR-0063 is unchanged. The new
case is a coach mark put off in the current document: Maybe later, and Escape or a press on the
scrim, which act as Maybe later, and Not again today each record `coachMarkDismissed` in the
onboarding store, and while it is set the pure `needsLauncherAttention` asks for the ring whatever
the stored plans or `panelFirstOpenedAt` say. Pressing the spotlit launcher is not a dismissal, so
it rings nothing; the student has found the planner. The ring itself is the one of ADR-0063: two
900 ms pulses after a 200 ms delay, a static ring held for 2000 ms under reduced motion, and never
under the welcome or the open coach mark.

The flag lasts for the document and is not stored. Opening and closing the panel leaves the class
in place, so the finished ring does not replay. When the student leaves the search page and comes
back, the coach mark shows again and the ring class drops while it is open, then returns after the
next Maybe later or Not again today, so the ring plays once after each dismissal.

Clearing the flag on the first panel open after the dismissal was rejected as needless: the ring
has finished by then, and clearing it would remove and add the class again on a later dismissal in
the same way. Storing the flag was rejected because the ask is about the moment after the choice,
and a stored flag would ring on pages where the student made no choice.

Owner decision, 2026-11-22. The owner confirmed the ring after Maybe later or Not again today as
it stands: the existing two pulses of ADR-0063, once after each dismissal, with the static ring
under reduced motion. A longer or repeating ring was not chosen, since a launcher that keeps
moving competes with the host page the student came to read.
