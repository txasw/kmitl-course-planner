# 9. PNG export: html-to-image

Status: Accepted
Date: 2026-07-07

## Context

Preview mode produces a shareable timetable poster. Users download it as a PNG or
copy it to the clipboard. The capture must work on a shadow root subtree and must
render Thai glyphs correctly.

## Decision

Use html-to-image to capture the preview composition at a raised device pixel
ratio on a white background. The same rendered composition drives the download,
the clipboard image, and the plain text export, so what the user sees is what
every export produces.

## Alternatives considered

A server side renderer is out of scope because the extension has no backend.
modern-screenshot is a candidate to evaluate only if font rendering issues appear.

## Consequences

Export fidelity depends on the capture library handling the shadow subtree and
the Thai capable font stack, which is verified manually when export ships.
