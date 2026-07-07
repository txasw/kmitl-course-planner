# Contributing

## Prerequisites

- Node 24 (see `.nvmrc`)
- pnpm 10 (pinned in `package.json`)

Install dependencies with `pnpm install`. A prepare step installs the git hooks
described below.

## Branch model

The default branch is `main` and it is protected. Direct pushes are rejected.
Every change lands through a pull request from a short lived branch named
`feat/...`, `fix/...`, `chore/...`, or `docs/...`. Merges use linear history,
force pushes and branch deletions are blocked, and the required continuous
integration checks must pass before a pull request can merge.

## Commits

Commits follow Conventional Commits with an imperative subject of 72 characters
or fewer. When the reasoning is not obvious from the diff, add a body that states
why the change was made and what alternative was rejected. Keep commits small and
atomic: one logical change each, and each commit should build and pass its own
gate.

Commit messages must not contain attribution trailers or emoji. A commit-msg
hook enforces this, and continuous integration re checks the pull request range.
Thai text in commit messages is allowed.

## Local gates

The git hooks run automatically:

- pre-commit runs lint-staged, which formats and lints staged files.
- commit-msg runs the message guard and commitlint.
- pre-push runs the type check and the test suite.

You can run the same gates by hand:

```
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

## Pull requests

Before requesting a merge, perform a written self review of the full diff against
correctness, the security checklist, test coverage for new logic, copy tone, and
commit history quality. Record the findings in the pull request description using
the template. Split a pull request whose diff grows large into reviewable slices
when practical.

## Design and copy

User facing copy and documentation use plain, neutral, professional English, and
Thai copy follows the same tone. Do not use emoji, decorative punctuation, or
marketing language. Use icon components for visual affordances.
