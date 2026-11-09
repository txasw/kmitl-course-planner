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

Commit messages must not contain attribution trailers or emoji. The only trailers
allowed are Signed-off-by, Refs and Fixes with issue numbers such as `#12`, and
BREAKING CHANGE. A trailer never carries a link, and a message never ends on a bare
link line. A commit-msg hook enforces this, and continuous integration re checks every
commit in the pull request range with the same rules.

The pull request description gets a narrower check, since it is Markdown that may quote
third party release notes. It rejects a Co-Authored-By line, a link inside a trailer
shaped final paragraph, and a bare link as the last line. The trailer allowlist, the
issue number format, and the emoji rule apply to commit messages only. The rules live in
`scripts/commit-msg-rules.mjs` with tests under `tests/scripts`. Thai text in commit
messages is allowed.

## Local gates

The git hooks run automatically:

- pre-commit runs lint-staged, which formats and lints staged files, and then the full
  type check.
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
correctness, the security checklist in the pull request template, test coverage for new
logic, copy tone, and commit history quality. Record the findings in the pull request
description using the template. Split a pull request whose diff grows large into
reviewable slices when practical.

A change that users will notice needs a changeset, recorded with `pnpm changeset`. The
changesets feed the changelog and the release notes.

## Design and copy

User facing copy and documentation use plain, neutral, professional English, and
Thai copy follows the same tone. Do not use emoji, decorative punctuation, or
marketing language. Use icon components for visual affordances.

## Landing site deploys

The project site at https://kcp.cecs.sh/ is the committed `site/` folder, rendered by
`pnpm site:build` from `scripts/landing` and served by Cloudflare Workers static assets as
`wrangler.jsonc` describes (ADR-0066). Cloudflare Workers Builds deploys it from `main`.
The repository holds no Cloudflare credentials and no deploy workflow.

### Rules

- Run `pnpm site:build` after any change to the landing copy, the renderer, the stylesheet,
  the script, or the images, and commit the result. Continuous integration renders the site
  again and fails when `site/` differs, so `main` never holds a stale page.
- The page states the version in `package.json`. Merge a release first, wait until that
  version is live on both the Chrome Web Store and Firefox Add-ons, then rebuild the site on
  the landing branch and merge it. Every merge to `main` that changes `site/` deploys at
  once, so this order is the only gate between a release and the page that describes it.

### Workers Builds settings

Create the Worker once from the Cloudflare dashboard with Workers & Pages, Create, Import a
repository, and enter these settings. Connect it after the first landing change is on
`main`, so the first build deploys a finished page.

| Setting                                             | Value                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Git repository                                      | `txasw/kmitl-course-planner`                                                     |
| Worker name                                         | `kcp-landing`, the `name` in `wrangler.jsonc`, which the build requires to match |
| Production branch (Settings, Build, Branch control) | `main`                                                                           |
| Enable Preview Builds (Branch control)              | Off                                                                              |
| Root directory                                      | Empty, the repository root                                                       |
| Build command                                       | Empty, because `site/` is committed                                              |
| Deploy command                                      | `pnpm exec wrangler deploy`                                                      |
| Build watch paths, include                          | `site/*` and `wrangler.jsonc`                                                    |
| Build watch paths, exclude                          | Empty                                                                            |
| API token                                           | Create new token, the default                                                    |
| Build variables                                     | None                                                                             |

The build image reads Node 24 from `.nvmrc` and runs pnpm 10.12.1 from the
`packageManager` field through Corepack, then installs the dependencies from
`pnpm-lock.yaml`. The deploy command runs the Wrangler version pinned in `package.json`,
and it fails rather than fetch another version if that pin is missing.

Do not add the domain in the dashboard. The route in `wrangler.jsonc`, `kcp.cecs.sh` with
`custom_domain` set, makes the first deploy create the DNS record and the certificate on the
`cecs.sh` zone, which is on the same account. The `workers.dev` address and preview URLs
stay off through the same file, so the site has one public address.

A push that changes no watched path, such as a change to the extension alone, starts no
build. To roll back, revert the change on `main`, or pick an earlier version under the
Worker's Deployments in the dashboard. To deploy by hand, run `pnpm exec wrangler login`
once and then `pnpm exec wrangler deploy` from the repository root.

After the first deploy, verify the domain in Google Search Console through a DNS TXT record
on `cecs.sh` and submit https://kcp.cecs.sh/sitemap.xml. Set the repository website and both
store listings' homepage to https://kcp.cecs.sh/. Bing reads the same sitemap, and the
Crawler Hints setting on the `cecs.sh` zone tells it when a page changes.
