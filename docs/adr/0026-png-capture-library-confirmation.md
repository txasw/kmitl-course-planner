# 26. PNG capture library confirmation

Status: Accepted
Date: 2026-07-10

## Context

ADR 0009 selected html-to-image for the preview poster export and named
modern-screenshot as a fallback to evaluate only if font rendering issues
appeared. That choice carried a real risk that could not be settled on paper.
The poster renders inside a shadow root that is closed in production, and the
Tailwind v4 stylesheet reaches the root as an adopted stylesheet rather than an
inline style element. The design tokens are declared on the host, and the grid
draws its hour and quarter lines, and the blocked hatch, with gradients built
from those token custom properties and a color-mix. If the capture library
failed to resolve any of that in its detached clone, the gridlines and hatch
would vanish from the image while the rest looked correct. A capture spike was
required to gate the phase before the rest of the sharing surface was built.

## Decision

Keep html-to-image. A spike captured a populated preview poster from a node held
by ref inside the React tree and inspected the resulting PNG. Every at risk
element rendered correctly: the hour and quarter gridline gradients, the
alternating day row shading, an event block with its hashed fill and white Thai
text, the poster header and footer, and Thai glyphs throughout, all on a white
background at device pixel ratio two. html-to-image reads each live node's
computed style and inlines it on the clone, so the token custom properties and
color-mix resolve to concrete values before the clone leaves the host, which is
why the adopted stylesheet and the closed root do not defeat it. Capturing from
a ref held inside the tree never reaches across the closed boundary. System
fonts need no embedding, so font embedding is skipped and the Thai capable stack
renders from the operating system in the clone as it does on screen.

## Alternatives considered

modern-screenshot was staged as the drop in fallback because it resolves adopted
stylesheets and shadow roots more explicitly, which is the exact axis the spike
tested. The spike passed, so the switch was not made and the extra dependency was
avoided. A server side renderer remains out of scope because the extension has no
backend.

## Consequences

The preview download, the clipboard image, and the plain text export all build on
one confirmed capture path. Pixel fidelity still depends on the viewer's operating
system carrying a Thai capable font, which is checked in the manual export QA. If a
future platform drops a gradient or a glyph, modern-screenshot stays a documented
drop in behind the same capturePng seam.
