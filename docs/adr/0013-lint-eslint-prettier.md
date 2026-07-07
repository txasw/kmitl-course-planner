# 13. Lint and format: ESLint and Prettier

Status: Accepted
Date: 2026-07-07

## Context

The project enforces correctness and a set of security restrictions in code:
no eval or Function constructor, no HTML injection, and no direct network calls
from the content script or feature code. Formatting must be consistent and not
fight the linter.

## Decision

Use ESLint flat config with the type checked typescript-eslint rule set and the
React presets, plus custom rules for the security restrictions. Run Prettier as a
separate formatting gate and use the Prettier compatibility config to disable
overlapping stylistic rules. The lint config is authored as an ECMAScript module
so it loads without a TypeScript loader.

## Alternatives considered

Running Prettier as a lint rule mixes formatting into linting and slows the
linter. The legacy eslintrc format is removed in the current ESLint major, so
flat config is the only supported option.

## Consequences

Type aware linting covers product and test sources, while configuration files are
linted without type information to avoid friction with untyped plugin configs.
Formatting and linting are independent gates in continuous integration.
