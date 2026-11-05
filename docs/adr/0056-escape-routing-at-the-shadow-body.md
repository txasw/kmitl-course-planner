# 56. Escape routing at the shadow body

Status: Accepted
Date: 2026-11-06

Amends ADR-0039 where it states that the overlay focus trap decides Escape on the panel.

## Context

The overlay closes on Escape through `useFocusTrap`, which handled the key in a native keydown
listener on the panel element. React delegates its own handlers to the React root, `#kcp-app`,
which sits above the panel, so the trap ran before any React handler inside the panel. A nested
surface that handled Escape in React could not keep the overlay open. The combobox shows the defect:
with its list open, Escape calls `preventDefault` and closes the list, but the trap had already
closed the whole overlay.

The v1.4 search disclosure, the catalog sheet, and later nested surfaces each need Escape to close
only themselves, one layer per press. The popovers, the tooltip, the hover card, the context menu,
and `useEscapeLayer` avoid the problem with native listeners that stop propagation, either on their
own node or in the capture phase on the document. That pattern does not reach a surface whose key
handling lives in React. The trap is also used nested: the bottom sheet runs its own trap inside the
overlay's, and the innermost trap must act first for both Tab and Escape.

The extension mounts inside a shadow root created by WXT with `isolateEvents`. That guard is a
keydown, keyup, and keypress listener on the body inside the shadow root that stops propagation, so
host page scripts never see the panel's keys. A listener on the shadow root itself, or anywhere
above that body, never fires.

## Decision

The trap keeps its keydown listener on the panel, and Tab wrapping is unchanged. Escape is decided
later. When an Escape reaches the panel unclaimed, the trap has a close callback, and the key is not
part of an input method composition, the panel listener hands the press to a one time listener on
the panel's nearest body ancestor: the shadow body in the extension, the document body in tests.
That body sits above the React root, so the decision runs after every React handler and every native
listener inside the panel. If the press is still unclaimed there, the trap claims it and closes. The
decider still runs beside the `isolateEvents` guard, because `stopPropagation` stops the event from
reaching parent nodes but does not skip other listeners on the current node. A press that an inner
handler stops before the body leaves its decider attached; the next key to reach the body removes
it, and an identity check keeps it from acting on that later key.

Nested traps hand off in the order their panel listeners run, innermost first, so the innermost
decider claims the press and every outer one sees it as handled. Keys from outside the panel, such
as the launcher and the toasts that render beside it, never reach the panel listener and keep their
own Escape behavior.

A press is claimed through its default prevented flag, which native listeners and React handlers
share. The pure helper `claimEscape` in `src/lib/ui/escape.ts` returns true, after calling
`preventDefault`, only for an Escape that no inner surface has claimed. A nested surface whose keys
are handled in React calls it from its `onKeyDown` and closes itself when it returns true. Bubbling
visits the innermost surface that holds focus first, so that surface wins. Inert or hidden surfaces
cannot hold focus, so they never see the key, and no registration stack is needed. The combobox
needs no change: its existing `preventDefault` is now honored. `useEscapeLayer` and the other native
surfaces keep working unchanged, because they stop the event before the trap sees it.

## Alternatives considered

Moving the whole listener to the shadow root, as first planned, was rejected because the
`isolateEvents` guard on the shadow body stops every key before it reaches the shadow root, so the
overlay would never close. A persistent listener on the body for each trap was rejected because
listeners on one node run in registration order, so the outer trap, registered first, would decide
before a nested one and close the overlay with the sheet. Turning the guard off for keydown was
rejected because the host page would then receive the panel's keystrokes. A shared stack of open
layers was rejected because it needs an ordering rule that the hand off order already provides.
Moving the trap to the capture phase was rejected because it would run before every inner surface,
which is the defect being fixed.

## Consequences

Escape closes the innermost open surface first and the overlay last, and a combobox list no longer
closes the overlay. A new nested surface that handles keys in React uses `claimEscape` and needs no
native listener; a surface that handles keys natively keeps using `useEscapeLayer`. Where the
accessibility lint forbids a key handler on a static or non interactive container, the handler sits
on the surface's controls or in a native listener instead. The decision relies on WXT mounting the
React root inside the guarded shadow body; if the mount structure changes, the unit test that models
the guard on the body and the browser tests that press Escape catch the regression.
