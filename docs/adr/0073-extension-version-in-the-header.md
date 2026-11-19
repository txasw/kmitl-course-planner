# 73. Extension version in the header

Status: Accepted
Date: 2026-11-20

Builds on the header layout of brief section 6.1.

## Context

A student who reports a problem, and a maintainer who reads the report, need to know which
release the student runs. The panel showed no version, so the only way to find it was the browser's
extension management page. The header is already dense, and the redesign of 2026-11-20 sets a hard
layout rule: no layout may overlap or clip text, and every label shows in full. The version is
reference information, not a task, so it must stay out of the way.

## Decision

The header shows the version as a small pill on the bottom right corner of the brand mark from the
640 px tier, where the mark shows. The pill reads `v` and the version in 10 px tabular figures in
the muted ink, on the surface fill with a 1 px border token edge and a full radius. It is positioned
out of flow inside the 24 px box of the mark, so the header keeps its height and the plan switcher
keeps its place. It may cover the lower edge of the mark, never any text: it reaches into the
header padding on the left and 4 px into the 12 px gap on the right, which leaves 8 px to the title
or the switcher. The pill is aria-hidden, and a screen reader reads the version as a phrase, such
as KCP version 1.5.0, from sr-only text beside the mark, so the dialog name stays the title alone.

Below 640 px the header hides the mark, so the overflow menu ends with a muted line that reads
KCP and the version. The line sits in the menu popover but outside the menu role, so it is neither
an item nor a tab stop, and it carries the same sr-only phrase.

The content script reads the version once at mount from `runtime.getManifest`, which needs no
permission, and provides it to the panel through a React context, so no component calls the
extension API. The read is wrapped: a runtime that throws, as an invalidated extension context
does, or a manifest without a version shows no version rather than a broken one. The version shows
as the manifest states it.

The preview poster and every export stay unchanged. The version describes the tool, not the plan,
and the export already carries a credit line.

## Alternatives

- A version line in the footer summary bar. Rejected because that bar describes the plan, and it is
  part of the poster composition, which would put the version into exports.
- The version in the header title text. Rejected because the title names the dialog, so a screen
  reader would hear the version on every open.
- An about dialog. Rejected as a new surface for one value, against the brief's no options page
  beyond the panel.

## Consequences

The version is one glance away on every tier without a new control. A future header change must
keep the 8 px clearance between the pill and the first text in the row; the responsive end to end
suite asserts that the pill keeps that 8 px clear of the switcher and of the title and that the
header stays one row, in Thai and in English, at the phone, tablet, and desktop widths.
