# 3. UI runtime: React in a closed shadow root

Status: Accepted
Date: 2026-07-07

## Context

The host page is a Vue and Vuetify application with aggressive global styles
marked important. The extension must render a rich planner interface without its
styles leaking into the host and without host styles leaking into it.

## Decision

Render the interface with React, mounted into a closed shadow root created by
the framework content script UI helper. The shadow boundary isolates styles in
both directions, and the closed mode keeps the root inaccessible to host page
scripts.

## Alternatives considered

Matching the host with Vue gains nothing because the extension is fully isolated
and does not share components with the host. An open shadow root would expose
the root handle to the page. Rendering into the light DOM would require fighting
the host important rules.

## Consequences

The drag and drop and icon libraries are chosen for their React support. All UI
state and event handling live inside the shadow tree, and styling relies on the
shadow scoped stylesheet described in the styling record.
