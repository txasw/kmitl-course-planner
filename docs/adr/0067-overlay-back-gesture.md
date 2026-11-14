# 67. Closing the overlay on back navigation

Status: Accepted
Date: 2026-11-14

Amends brief section 6.1, which says closing the overlay reveals the host exactly as it was with the
reversible scroll lock as the sole side effect. Reviewed against rule 6, read only integration with
the host site.

## Context

On a phone the system back gesture is the habitual way to leave a full screen surface. The overlay
covers the whole viewport, but it has no history entry of its own, so a back gesture while it is
open navigates the host instead: the host router moves to the previous route behind the panel, or
the page unloads when the previous entry belongs to another document. Either way the student loses
the page they came from while the panel stays in front of it.

Closing on back needs one entry in the host's session history, which is shared by the host and the
extension. Rule 6 forbids interfering with the host application, so the entry must be invisible to
the host router and must leave every host entry as it found it.

The host runs Vue Router 3.6.5 in hash mode, read from the live vendor bundle. Because the browser
supports `pushState`, the router listens to `popstate` rather than `hashchange`. On `popstate` it
transitions to the current hash. When that hash names the current route, `confirmTransition` calls
`ensureURL`, which writes nothing because the URL already matches, and aborts with a duplicated
navigation failure, which it neither logs nor reports. Its own entries carry a `key` in
`history.state`, and when a scroll behaviour is configured it restores scroll by the `key` it reads
from `event.state` on `popstate`. The live application configures none today, so the router reads
no `key` on these traversals.

A content script cannot read `history.state` reliably. Chromium caches the value per JavaScript
world and refreshes the cache only for the world that read it most recently, so once the page reads
`history.state`, which the host router and other extensions do, the content script keeps seeing a
stale value. A check on the live site confirmed it: after the page read the state, the content
script read `null` while the page read the marker.

## Decision

Opening the overlay pushes one entry on top of the current one, with the same URL, so no
`hashchange` fires and the router does not see it. Its state holds one marker field, `kcpOverlay`,
with a random token for this opening, and nothing copied from the host, because a copy read from
the content script could be stale. The router reads no `key` from this entry while no scroll
behaviour is configured. The extension never calls `replaceState`, so no host entry is rewritten.

While the overlay is open, a `popstate` means the student left that entry, and the overlay closes
through the same `close` action as Escape and the close control, so focus returns to the launcher
and the scroll lock releases. The traversal itself already removed the entry from the top, so
nothing more is done to history.

A close by Escape, the close control, or an unmount calls `history.back()` once, and only when
`history.length` and the URL are still what they were right after the push. When the host or
anything else pushed an entry, or replaced the entry with another URL, in the meantime, the
extension leaves history alone rather than unwind an entry it does not own. The decision never
reads `history.state`, for the reason given above.
An opening that starts before the `popstate` of an earlier close has arrived waits for it before
pushing, so a quick close and reopen cannot reorder the two traversals.

The push is skipped when the document has no transient user activation. Chromium marks the entry
below a push made without user activation as skipped by the back gesture, so a back from the
overlay entry would pass over the host's own entry and leave the page the student was on. Sticky
activation is not enough: after a same document back or forward, which every close by back is,
Chromium stops honouring an earlier activation for new entries until a fresh one arrives. A panel
opened from the launcher always has a fresh activation; one opened from the toolbar action or its
shortcut has none, and keeps the behaviour from before this change.

## Alternatives considered

Rewriting the current entry with `replaceState` to add a marker was rejected. It edits an entry the
host owns, and the marker would outlive the panel in the host's history.

Pushing an entry with a hash of its own was rejected. The router would read it as a navigation to a
route it does not know, which is exactly the interference rule 6 forbids.

Listening to `hashchange` alone was rejected. A back gesture to the entry below fires `popstate` and
no `hashchange` when the hash is the same, so the overlay would never hear it.

The Navigation API's `navigate` event was rejected for now. Support differs across the target
browsers, and it would still need an entry to intercept.

## Consequences

Closing the overlay reveals the host with the same route, the same URL, and the same
`history.state` it had before opening, since the host's own entry was never touched. The one trace is a forward entry carrying the marker, which
the browser's forward control can reach and which the next host navigation discards. Moving forward
onto it is a same hash `popstate`, which the router ignores and which the closed overlay does not
hear, and leaves one back step that changes nothing visible.

Two edge cases fall outside the length and URL check. A host `replaceState` that keeps the URL
would be unwound by the close, and at the browser's cap of 50 entries a host push does not change
the length. Neither happens while the overlay covers the page, since the host navigates only on
the student's input.

A back gesture closes the whole overlay, not an inner sheet or dialog. Session state lives in the
ui store, so reopening resumes where the student left off.

The router behaviour this depends on was read from the live bundle. A host upgrade to a router that
treats a same hash `popstate` as a navigation would surface as a reload of the current route behind
a closing panel, and the check is to be repeated on the live site before each release that changes
this hook.
