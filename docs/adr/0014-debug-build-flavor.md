# 14. Debug build flavor

Status: Accepted
Date: 2026-07-07

## Context

Live data occasionally deviates from the documented contract, and those
deviations must be caught during development the moment they happen. The
production build must contain no diagnostic code.

## Decision

Ship diagnostics as a build flavor of the single extension, gated by a compile
time define. Debug only modules are imported dynamically behind the define so the
bundler drops them from production output. The debug manifest name carries a
suffix so the loaded flavor is identifiable, and every debug module embeds a
canary string that continuous integration greps for in production bundles.

## Alternatives considered

A separate debug extension was rejected. It would duplicate parsing and
normalization logic that then drifts, it cannot observe internal state such as
stores and cache contents, and it doubles the review and signing surface while
adding nothing beyond what browser devtools already provide for plain network
inspection.

## Consequences

One codebase serves both flavors. The canary grep in continuous integration is
the guarantee that production output stays free of diagnostic code.
