# 12. Testing: Vitest and Playwright

Status: Accepted
Date: 2026-07-07

## Context

The domain layer is the most tested code in the project and must be verified in
isolation. Component behavior and the end to end flow of loading the extension
and driving the grid also need coverage.

## Decision

Use Vitest with Testing Library for unit and component tests, and Playwright for
end to end tests against the built extension on Chromium. A line coverage gate
applies to the pure domain layer. The build flavor flag is defined in the test
config so debug paths are excluded when tests run.

## Alternatives considered

Jest would need extra configuration to match the Vite based build and is slower
here. Cypress is a heavier end to end tool than the extension flow requires.

## Consequences

The coverage gate is scoped to the domain layer, where the value is highest.
Playwright loads the built extension, which keeps the end to end tests close to
what users run.
