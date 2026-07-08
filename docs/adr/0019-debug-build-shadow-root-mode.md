# 19. Debug build shadow root mode

Status: Accepted
Date: 2026-07-08

Refines record 3, UI runtime: React in a closed shadow root.

## Context

Record 3 mounts the interface inside a closed shadow root so the root handle is
inaccessible to host page scripts. Closed mode also blocks tooling that must read
the tree from outside the extension: in browser accessibility scanners cannot
pierce a closed root, and browser driven end to end tests cannot locate elements
inside one. Under record 3 the only way to run those checks was to edit the mount
mode to open by hand and remember to revert it, which is error prone and leaves a
manual step that can ship by accident.

Record 14 already establishes that the extension is one codebase built in two
flavors, gated by the compile time flag the bundler inlines as a boolean literal.
The production flavor must remain fully isolated from the host; the debug flavor
is never published and is used only during development and in continuous
integration.

## Decision

Derive the shadow root mode from the build flavor: open in debug builds, closed in
production. The mount reads the same compile time flag every other debug gated path
reads, so production inlines the literal false, keeps the closed root, and dead
code eliminates the open branch, while debug builds mount an open root that
accessibility scanners and the browser driven test harness can read without any
source edit.

## Alternatives considered

Keeping a single closed mode and editing it by hand for each scan or test run was
rejected because it is manual, easy to forget, and risks shipping an open root to
production. A permanently open root was rejected because it drops the host
isolation that record 3 requires of the shipped product. A separate test only
build target was rejected because record 14 already commits to two flavors from one
codebase, and adding a third would duplicate build surface for no gain.

## Consequences

The production root stays closed and isolated exactly as record 3 requires; nothing
about the shipped product changes. The debug root is open, which is acceptable
because that flavor is never published. Accessibility scans and the end to end
suite run against the debug build and reach the tree directly, so the manual mode
edit is gone. If a future need requires a closed root even in debug, only the one
mount expression changes and this record is superseded.
