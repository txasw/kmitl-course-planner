# 16. KMITL orange verification

Status: Accepted
Date: 2026-07-08

## Context

Section 8.1 sets the primary brand token --kcp-primary to #E35205 and asks that
the value be verified against the official KMITL corporate identity during the
theme phase, correcting the single token if the guideline states a different
value.

## Decision

Retain --kcp-primary as #E35205. The KMITL corporate identity specifies the
institute orange as Pantone 166 C. The standard sRGB rendering of Pantone 166 C is
RGB(227, 82, 5), which is #E35205 and equals the brief token, so no change is made.
The token stays the single source of truth for the orange and is mapped into the
Tailwind primary color utilities.

## Alternatives considered

Sampling an orange from a logo image was rejected because sampled values shift with
compression and rendering, while the Pantone reference is the authoritative
specification the corporate identity names.

## Consequences

The brand orange is anchored to a named Pantone reference rather than a screenshot.
If an official KMITL corporate identity document later publishes a different sRGB
value for Pantone 166 C or for the institute orange, only this one token changes and
this record is superseded.

## Sources

- KMITL corporate identity communications identifying the institute orange as
  Pantone 166 C.
- Public Pantone 166 C conversions to RGB(227, 82, 5) and #E35205, for example
  colorxs.com and icolorpalette.com.
