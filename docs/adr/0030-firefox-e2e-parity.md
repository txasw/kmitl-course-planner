# 30. Firefox end to end parity

Status: Accepted
Date: 2026-07-10

## Context

The end to end suite loads the built extension into a real browser and drives it
against an in process mock of the two KMITL origins. It runs on Chromium through
`chromium.launchPersistentContext` with the `--disable-extensions-except` and
`--load-extension` arguments, which is the supported way to side load an unpacked
Manifest V3 extension into Chromium. The Phase 8 acceptance asks for a Firefox smoke
of the drag and the export, since those are the two surfaces most likely to differ
between engines: the pointer drag depends on the engine's pointer events, and the
image export depends on the engine's canvas and clipboard support. This record settles
whether that smoke can be automated under the existing Playwright harness or has to be
a manual checklist.

The attempt was made and measured. Playwright ships its own Firefox build (151.0,
playwright firefox v1532). A `firefox.launchPersistentContext` with
`args: ['--load-extension=.output/firefox-mv3-debug']` launches the browser but does
not load the extension: `context.backgroundPages()` returns an empty list, so the
extension background never started, and the `--load-extension` flag, which is a
Chromium flag, is ignored by Firefox rather than honored. The `backgroundPages()` and
`serviceWorkers()` methods that the Chromium fixture uses to reach the extension worker
exist on the Firefox context object but return nothing, because they are Chromium
extension inspection surfaces with no Firefox equivalent. Playwright exposes no API to
install or inspect a Firefox extension.

## Decision

No Firefox project is added to the Playwright configuration, and the Firefox smoke of
the drag and the export is a scripted manual checklist in `docs/MANUAL_QA.md`, run
against the unpacked `firefox-mv3-debug` build loaded through `about:debugging` as a
temporary add on. That checklist is the recorded acceptance for Firefox parity. The
Chromium end to end project stays the automated gate for behavior that is engine
independent, since the domain, planner, and export logic is one codebase and its unit
and component tests already cover it without a browser.

## Alternatives considered

A Firefox Playwright project was rejected because it cannot load the extension, so
every spec would fail at setup; a project that cannot run is dead configuration, not
coverage. Loading the extension through `web-ext run` or the Firefox remote debugging
protocol was rejected because it is a second test runner outside the Playwright fixture
model, with its own browser lifecycle, its own mock wiring, and its own flake surface,
which doubles the end to end maintenance for the one engine difference the manual
checklist already covers. Signing the extension and installing the signed archive into
the profile was rejected because it needs an unbranded or nightly Firefox to relax the
signature requirement and a signing round trip on every build, which is disproportionate
to a smoke test that a person runs at a release boundary. Testing the content script
bundle in a plain Firefox page without the extension mechanism was rejected because it
would not exercise the background worker, the closed shadow root mount, or the host
permission model, so it would not be a faithful smoke of the shipped product.

## Consequences

The drag and the export are verified on Firefox by a person following the standing
checklist against a temporary add on, which is the honest level of assurance available
without a supported automation path, and the checklist calls out the engine specific
risks to look at: the pointer drag, the image capture through `html-to-image`, the image
clipboard write with its download fallback, and the shadow root isolation from the host
page. If Playwright gains Firefox extension loading, or the project adopts a signed build
pipeline, this decision is revisited and the checklist items become automated specs under
a Firefox project rather than being replaced piecemeal.
