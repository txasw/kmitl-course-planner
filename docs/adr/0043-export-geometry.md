# 43. Export geometry: smart window, transposed portrait, axis, watermark

Status: Accepted
Date: 2026-07-13

Amends ADR-0041 (export templates). Records ruling one of the v1.2.0 second wave.

## Context

A review of the first template set found the poster geometry lacking in four ways. The
window followed fit to content, so a poster trimmed to whatever hours the plan happened to
use rather than reading as a familiar working day. The tall phone canvas showed the
landscape grid as a thin horizontal band, wasting most of its height. The hour axis
clustered its labels left-aligned at the tick marks rather than reading as an even ruler.
And the type scale was one fixed size, so text overflowed at some canvas sizes while a
watermark of origin was absent entirely.

## Decision

Four changes, all in the poster geometry, none touching edit mode.

Smart window. A new `computeSmartWindow` and `smartVisibleDays` in `grid.ts` render the
08:00 to 18:00 working day as the base, extended to the hour boundary that clears any
meeting outside it, and Monday to Friday as the base week, revealing Sunday for a Sunday
meeting and both Saturday and Sunday for a Saturday meeting. This supersedes fit to content
for templates. The precedence is template canvas, then smart window, then display options;
the fit to content option is retired from the display options list, its schema field kept
for back-compat.

Orientation is a template property. `ExportTemplate` gains `orientation`; a landscape
template lays out days as rows and time as columns, a portrait template transposes to days
as columns and time flowing down, the natural fit for a tall canvas. The set gains
`phone-wallpaper-portrait` beside the kept landscape phone. `WeeklyGrid` takes an
`orientation` prop and swaps the grid template, the block placement, the lane gradient
direction, and the axis and day-label positions; `grid.ts` stays pure minute-to-index math
and is reused unchanged. The transpose is read-only, since portrait renders only in preview
and export where the drag machinery never runs.

Axis redesign. The hour labels center on their gridline, the first label left-aligning so it
stays inside the canvas, which reads as an evenly ticked ruler. A stronger rule marks midday
and the window edges. The axis label size comes from the template type scale, so it is
proportionate at each canvas size. The leading axis track is a fixed size rather than auto,
since the labels are absolutely positioned to center on their line and would otherwise
collapse the track.

Per-template type scale. `ExportTemplate` gains `posterFontPx`; the poster root and the grid
set it as their font size and the block and axis text are em relative, so a template scales
its whole type ramp from one number and can shrink a step where text would clip. The density
rule from the first wave still governs which field yields first, so the essential time and
name never clip while the foot may.

Watermark. A quiet monochrome credit rides the honesty footer position in the bottom-right of
every export, present in every template including portrait, not user removable, part of the
captured composition. The ink-soft on surface pair clears the AA text bar and the size is em
relative.

## Alternatives considered

A free orientation toggle was rejected: it would create a matrix of half-meaningful layouts
where a portrait grid on a landscape canvas makes no sense. Binding orientation to the
template keeps every combination deliberate. Keeping fit to content as the template window
was rejected because a poster wants a familiar frame, not a trim. A global type scale was
rejected because the canvases differ enough that one size clips on some and wastes space on
others; per-template scale fits each.

## Consequences

A poster now reads as a working week at a familiar size, a tall canvas fills top to bottom,
the axis reads as time, text fits at every preset, and a shared image carries its origin.
The transpose is contained to `WeeklyGrid` and the pure geometry in `grid.ts` is unchanged,
so edit mode is untouched. The exact-pixel export from ADR-0041 still holds: the portrait
template lands its output dimensions precisely, verified by the IHDR decode in the E2E.
