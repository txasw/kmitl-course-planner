# 57. Collapsed course cards and the course hover preview

Status: Accepted
Date: 2026-11-06

Amends ADR-0024 (the course header carried the course drag only, out of the tab order) and
ADR-0021 (the row hover ghost used a dashed border).

## Context

Every catalog card rendered every section of its course. A GenEd category result is about 100
courses, so the list was long to scan, a student had to scroll past sections of courses they had
no interest in, and the dense 500 section catalog mounted about 500 section drag sources. A card
already collapsed once its course was added, through local state that a remount lost. The owner
asked for cards that collapse and expand on hover.

The course card header was the pointer source for the course drag, marked touch-none with an
accessible name that described the drag, and the title truncated to one line with a tooltip for
the full name.

## Decision

Collapsed by default. Every card, added or not, starts collapsed to one header line: the subject id
and the primary name as one title clamped to two lines, the credit string and a chevron. A long
name breaks inside a word rather than cutting to an ellipsis, so the tooltip goes. The header
button, a `data-course-toggle` inside an `h4` under the group heading, is the disclosure: a click,
Enter or Space opens or closes the card, `aria-expanded` carries the state, `aria-controls` points
at the body, and the button is named by the title and the credits. Several cards can be open at
once. Opening never moves focus. Controls such as the remove on an added card sit beside the
button, never inside it.

Rows mount only when open. The body is always in the tree so `aria-controls` resolves, but its
rows mount only while it is open or animating, so a collapsed card registers no section drag
source. The body opens with a grid row transition from 0fr to 1fr on the motion tokens, the rows
fade in a moment later, a closing body is inert, and reduced motion drops the transition. The full
primary name and the secondary name with its `lang` show on the first line of the body.

State keyed by query, tagged by placement. The catalog store holds the open choices keyed by the
result query, as JSON with sorted keys, so a refresh of the same search keeps them and a new search
starts clean. Each choice records whether its course was placed when it was made, and a choice
whose tag no longer matches the plan is ignored and then dropped. An added card therefore always
starts collapsed, and a course that leaves the plan through a remove, an undo or a grid move is
collapsed again. None of the add or remove paths needs to know about the disclosure. Nothing is
persisted; the store survives closing and reopening the overlay as section 6.1 requires.

Auto open. A card opens without a choice when the unfiltered result holds one course, or when the
text filter equals its subject id exactly. A subject id search and the feedback strip's reveal in
the list, which sets the text to the subject id, therefore show the sections at once, and typing a
partial id opens nothing, so the list never flickers while typing. An added card never auto opens.

Scroll after expand. Once a user expand settles, the catalog scroller moves just enough to show the
card, and never so far that the header leaves the top. The top inset is the scroller's
scroll-padding-top, so a sticky bar at its head is respected. An auto opened card never scrolls.
The scroller carries `data-catalog-scroller` and turns off overflow anchoring, so the catalog owns
its anchoring and the browser never anchors on a row inside a closing body.

Course drag stays pointer only. The header is still the course drag source, so the amendment to
ADR-0024 is that it is now also a keyboard reachable disclosure, while the drag itself keeps no
keyboard path and loses its accessible name; the grip and the grab cursor are its visual hint.
dnd-kit swallows the click that ends an activated drag, so a header drag never toggles the card,
and a component test pins that behaviour. The header changes from touch-none to touch-pan-y as an
interim: a vertical swipe on it scrolls the list, a horizontal swipe still starts the course drag,
and a tap toggles. The touch input model ADR replaces this with a long press.

The fit line and Expand all. A second line inside the button summarizes a collapsed course: its
section count, the days it meets, and one fit status built on the same candidate engine as the
course drag, so it agrees with what opening the card shows. It is the authoritative fit answer at
every tier and is read as the button's description. An Expand all and Collapse all control on the
summary row acts on the visible cards without animation.

The course hover preview. Hover keeps a reveal role without moving the list: resting the mouse on a
collapsed card draws where its sections would land on the grid. It runs on docked tiers only, for
a mouse only, never on added or cross term cards, and clears on leave, scroll, a press or Escape.
Its footprints are not drop targets, so they use a 2 px dotted border that no target uses: success
with a section label for a fit, a faint danger hatch with no label for a clash, and ink soft with
no label for a full or closed section. Dotted means preview, so the row hover ghost of ADR-0021
changes from dashed to dotted as well.

As built in this change: the collapsed default, the disclosure and its state, auto open, the
motion, the scroll after expand, and the drag header changes. The fit line, Expand all, the
hover preview and the dotted row hover ghost follow in later changes under this record, so the row
ghost stays dashed until the preview lands.

## Alternatives considered

Expanding on hover, the owner's mechanism, was rejected. The wheel moves the list under a still
pointer, so cards would open by accident, and any open on enter or close on leave rule pushes the
next card away from a pointer moving down and shifts the surface a student is about to grab for a
course drag. It does nothing for touch, the keyboard or a screen reader, so a click toggle is
needed anyway, and two triggers make the state hard to predict. Hover gets the grid preview
instead.

An exclusive accordion was rejected: it blocks comparing two subjects that compete for one slot,
closing a card above the view needs hand written scroll compensation, and an automatic close
removes a keyboard user's context without their action. A side flyout was rejected because it
covers the grid, the drop target and the place the preview belongs, and drag sources inside a layer
that closes on leave are fragile.

Sticky card headers were rejected because they stack against a sticky summary bar and obscure
focus, and most GenEd courses have one to six sections, so an open card mostly fits on screen.
Arrow key roving between card headers is deferred, since collapsed cards already cut the tab stops
to one per course. A click suppression flag after a drag was not added, because dnd-kit already
suppresses that click. content-visibility on cards was rejected because unmounted bodies remove
most of the layout cost and intrinsic size placeholders would make the reveal scroll approximate.
A max-height animation was rejected because it needs a guessed ceiling that clips a long section
list. Keeping the disclosure as local state in each card was rejected because a remount loses it.

## Consequences

A collapsed result mounts no section rows, so the dense catalog of about 500 courses registers
one header drag source per course instead of those headers plus about 500 section row sources, and
a card's rows mount on demand. A student opens a card
before adding from its rows, so the end to end specs that add from a multi course result open the
card first through one helper. The title wraps to two lines, so card heights vary with name
length. On a tablet a vertical swipe that starts on a card header now scrolls instead of starting a
course drag, which is the intended change until the long press lands.
