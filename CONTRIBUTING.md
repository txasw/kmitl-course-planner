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

## Imports

WXT auto imports are off (`imports: false` in `wxt.config.ts`). Every module imports
what it uses explicitly, including `browser`, the WXT helpers such as `defineBackground`,
and React hooks, so code that relies on an auto import fails the type check.

## Bundle size budget

CI zips each production target and fails the build when a zip is larger than its
budget in `scripts/bundle-budget.mjs`. The budget sits a little above the current
size, so the package does not grow by accident. To check a build by hand:

```
pnpm wxt zip -b chrome
pnpm wxt zip -b firefox
node scripts/check-bundle-size.mjs chrome firefox
```

When a change needs more room, first look for what it pulls in, such as a new
dependency or a heavy import. If the growth is justified, raise the budget in the same
pull request and give the new size and the reason in the description. When a change
makes the package smaller, lower the budget to keep the margin small.

For release 1.6 the budget is 320 KiB for each target, an owner decision of
2026-11-22. Replacing libraries with smaller ones to win back room is not pursued for
this release. A change that would go past 320 KiB is reworked to fit rather than raising
the budget.

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
`wrangler.jsonc` describes (ADR-0066). The workflow `.github/workflows/deploy-site.yml`
deploys it when a version is released, after the owner approves the deploy (ADR-0080).
Once Workers Builds is retired, as described below, a merge to `main` alone deploys nothing.

### Rules

- Run `pnpm site:build` after any change to the landing copy, the renderer, the stylesheet,
  the script, or the images, and commit the result. Continuous integration renders the site
  again and fails when `site/` differs, so `main` never holds a stale page, and the deploy
  runs the same check before it publishes anything.
- The page states the version in `package.json`. The release workflow runs
  `pnpm release:version`, which is `changeset version` followed by `pnpm site:build`, so the
  Changesets release pull request carries the rebuilt `site/`. Merging it tags the release,
  and the release workflow then deploys the page that states the new version. Nothing needs
  bumping by hand after a release. The site test fails when the committed page states any
  other version than `package.json`.
- A landing change goes live with the next release. A change merged to `main` between
  releases waits for it, so copy that describes an unreleased feature can merge with that
  feature.

### How a deploy runs

The deploy workflow has two jobs. The `build` job runs only from `main`. It checks out the
released commit and fails unless `main` contains that commit, records the commit, installs
the dependencies from the lockfile, checks that `site/` is current, and runs
`wrangler deploy --dry-run` without any credential. The `deploy` job runs in the GitHub
Environment `cloudflare-production`. It checks out `wrangler.jsonc`, `site/`,
`package.json`, and `pnpm-lock.yaml` from the recorded commit, installs the dependencies
again from the lockfile with lifecycle scripts disabled and no cache, so every package
Wrangler loads matches its locked integrity hash, and runs `wrangler deploy`. It takes
nothing the build job wrote, so no package from the build job runs in it or changes what it
publishes, and the token is set on the single deploy step only. The release workflow passes
the token to the called workflow by name, since a called workflow reads an environment
secret only when its caller passes it. Deploys never overlap, and a running deploy is never
cancelled.

The environment `cloudflare-production` has these settings:

| Setting                      | Value                                              |
| ---------------------------- | -------------------------------------------------- |
| Required reviewer            | The owner, who approves every deploy               |
| Deployment branches and tags | `main` only, since both deploy paths run on `main` |
| Environment secret           | `CLOUDFLARE_API_TOKEN`, the custom token below     |
| Environment variable         | `CLOUDFLARE_ACCOUNT_ID`, the Cloudflare account id |

The token lives only as that environment secret, never as a repository secret. It is a
custom API token, never the Global API Key and never the Edit Cloudflare Workers template,
which also grants KV, R2, and tail access. It has these permissions and expires one year
after it is created:

- Account, the one account: Workers Scripts Edit, to upload the Worker and its assets.
- Account, the one account: Account Settings Read, which Wrangler reads at deploy.
- Zone, `cecs.sh` only: Workers Routes Edit, for the custom domain route.
- Zone, `cecs.sh` only: Zone Read.

DNS Edit is not needed, because the custom domain and its record already exist. If a deploy
fails with a permission error, add only the scope that the error names and record it in this
list. Before the token expires, create a new one with the same permissions, replace the
environment secret, and delete the old token.

### Redeploy and roll back

To deploy a released tag again, or to roll back to an earlier one, open Actions, choose
Deploy site, and run the workflow from `main` with the tag, such as `v1.7.2`. The workflow
accepts only a tag of the form `v` followed by three numbers separated by dots whose commit
`main` contains, and it stops when it is run from any other branch or tag. The owner
approves the deploy in the environment review before it runs. A tag released before the
deploy workflow existed deploys its committed `site/` the same way. For an immediate revert,
the Worker's Deployments page in the Cloudflare dashboard can also restore an earlier
version; the next deploy from the workflow replaces it.

### Retiring Workers Builds

Cloudflare Workers Builds deployed the site from `main` before this workflow. It stays
connected only until the first dispatched deploy of a released tag succeeds. Then open the
`kcp-landing` Worker in the dashboard, Settings, Build, and disconnect the Git repository,
so that no push starts a build and only the release deploy publishes the site.

### Domain

Do not add the domain in the dashboard. The route in `wrangler.jsonc`, `kcp.cecs.sh` with
`custom_domain` set, makes the first deploy create the DNS record and the certificate on the
`cecs.sh` zone, which is on the same account. The `workers.dev` address and preview URLs
stay off through the same file, so the site has one public address.

After the first deploy, verify the domain in Google Search Console through a DNS TXT record
on `cecs.sh` and submit https://kcp.cecs.sh/sitemap.xml. Set the repository website and both
store listings' homepage to https://kcp.cecs.sh/. Bing reads the same sitemap, and the
Crawler Hints setting on the `cecs.sh` zone tells it when a page changes.
