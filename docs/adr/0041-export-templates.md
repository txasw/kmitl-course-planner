# 41. Fixed export templates

Status: Accepted
Date: 2026-07-13

Supersedes the Phase 7 on-screen capture approach. Amends ADR-0009, ADR-0026, and
ADR-0027.

## Context

Through Phase 7 the preview poster captured whatever the panel happened to render:
its size followed the viewport and its resolution followed the device pixel ratio,
so the same plan produced a different image on a laptop, an external monitor, and a
high density display. A shared timetable is a poster people set as a wallpaper or
paste into a chat, and those uses want a known, fixed size, not a screenshot of one
person's window. The design review asked for a small set of named export sizes so a
download is predictable and reusable.

ADR-0009 chose html-to-image for the capture, ADR-0026 confirmed it after the Phase 7
manual check, and ADR-0027 fixed the composition rules: the unscheduled shelf and the
verification badges are part of the poster, so an export is honest about the credits
it carries and their verification state. None of those decisions is in question. What
changes is that the capture size is now fixed by a template rather than read from the
viewport.

## Decision

Add a small fixed set of export templates in `lib/planner/exportTemplates.ts`, each a
`{ slug, labelKey, layoutWidth, layoutHeight, pixelRatio }` record. The template fixes
the poster to a layout box in CSS pixels and scales it by the pixel ratio to an exact
integer output size, independent of the viewport and the device pixel ratio. The set
is named by use case, never by a device brand, and there are no custom sizes: Share
16:9 (1920x1080), Phone wallpaper portrait (1080x2340), Tablet wallpaper portrait
(1668x2388), and Print A4 landscape (3508x2480 at 300 dpi). Every layout width stays
at or above the grid minimum of 44rem so the seven day columns never overflow.

In preview the poster is fixed to the selected template's layout box and the preview
stage scales it to fit the pane with a display-only CSS transform. The transform is on
a wrapping element, not the poster, so html-to-image reads the poster's own layout box
and lands the exact template pixels regardless of the on-screen scale. `capturePng`
stays the single capture seam and takes the template pixel ratio. The picker lives in
the preview toolbar, its selection persists through an optional `exportTemplate` field
in the preferences (no schema version bump), and the file name carries the template
slug so downloads of different sizes do not collide.

The composition rules from ADR-0027 still hold at every template size: the poster
header, the grid, the unscheduled shelf, the credits, and the verification badges all
render. A template scales and reflows the poster; it never crops the shelf out, so a
smaller canvas can never hide credits a plan contains. Fit to content still decides
the time window and the day rows; the template decides the canvas.

## Alternatives considered

A free custom size field was rejected because it invites unusable aspect ratios and
defeats the point of a predictable, named export. Rendering each template into a
detached node appended to `document.body` was rejected because that node would lose
every `--kcp-*` token and the `color-mix` gridlines, which resolve only inside the
shadow root; the poster stays inside the panel, positioned for capture, so the tokens
resolve. Capturing at the on-screen scale and upscaling the bitmap was rejected because
it blurs text; fixing the layout box and setting the pixel ratio renders crisp at the
target size.

## Consequences

A download is now identical on any screen and matches a documented size, which the
store screenshots and any wallpaper use depend on. The E2E decodes the IHDR width and
height of a real downloaded PNG for two presets, so a regression in the capture size is
caught in CI rather than by eye. The honesty rules from ADR-0027 are unchanged and the
capture library from ADR-0009 and ADR-0026 is unchanged; only the size is now fixed,
which is why this supersedes the on-screen sizing and amends rather than replaces those
records.
