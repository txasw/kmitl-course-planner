# 20. Combobox popup positioning with floating-ui

Status: Accepted
Date: 2026-07-08

## Context

The search rail renders every select as one reusable combobox with a listbox
popup. The rail is a fixed width column that scrolls its own overflow, so a popup
positioned as an ordinary absolutely placed child is clipped by the rail and
always drops downward. When a combobox sits low in the rail the list runs past
the panel and is cut off. A correct popup has to flip above the field when the
space below is short, cap its height to the space available and scroll internally
beyond that, track the field as the rail scrolls or the window resizes, and stay
within the panel, all inside a shadow root.

This positioning is the same set of concerns for every select, since the combobox
is the single primitive the rail uses. Getting it right by hand means measuring
the field and the viewport, choosing a side, recomputing on scroll and resize,
and escaping the scroll container's clip, which is a well understood but easy to
get wrong piece of layout code to own and test.

## Decision

Position the popup with floating-ui through its React bindings. The combobox uses
`useFloating` with a fixed strategy so the popup escapes the scrolling rail's
clip, the flip middleware to drop the list above the field when the space below is
insufficient, the size middleware to match the field width and cap the height to
the available space with internal scrolling, and autoUpdate to keep the list
aligned as the rail scrolls or the window resizes. The comboboxes render only in
the rail, which has no transformed ancestor, so the fixed strategy resolves
against the viewport and no portal is required.

floating-ui is pure computation with no external assets or network access, so it
satisfies the content security policy and the no remote assets rule, and it is
tree shakeable so only the middleware in use is bundled.

## Alternatives considered

Hand rolled positioning with `getBoundingClientRect`, a fixed strategy, and manual
scroll and resize listeners was rejected because it reimplements flip, size, and
auto update for a primitive used by every select, and it carries a caveat that a
transformed ancestor would break the fixed strategy that the library already
handles. Keeping the absolutely placed popup and only capping its height was
rejected because it does not flip and stays clipped by the rail. A larger
interaction library was rejected because the combobox already owns its keyboard,
filtering, and aria behavior and needs positioning only.

## Consequences

One small runtime dependency enters the project, pinned exactly with the committed
lockfile like every other dependency. The combobox popup now flips, caps its
height, and stays within the panel on every viewport, and future popovers can
reuse the same library rather than each inventing positioning.
