# 1. Extension framework: WXT

Status: Accepted
Date: 2026-07-07

## Context

The product ships as one browser extension for Chromium browsers and Firefox
from a single codebase, on Manifest V3. It needs file based entrypoints, per
browser manifest generation, a fast development loop, and packaging tooling.

## Decision

Use WXT with the React module. WXT generates a correct Manifest V3 output for
each target, including the Firefox appropriate background shape, and provides
Vite based hot reload, zipping, and store submission commands. Entrypoints live
under a configured source directory.

## Alternatives considered

CRXJS focuses on Chromium and has a weaker cross browser story. Plasmo adds a
heavier abstraction layer. A raw Vite setup with a polyfill would require owning
more build scripting. WXT has the strongest first class cross browser support of
the options.

## Consequences

The project depends on WXT conventions for entrypoints and configuration.
Manifest details are expressed through the WXT config rather than a hand written
file, and a prepare step generates types that the type checker relies on.
