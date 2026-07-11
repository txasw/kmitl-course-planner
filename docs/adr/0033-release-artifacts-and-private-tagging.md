# 33. Release artifacts, sources packaging, and private package tagging

Status: Accepted
Date: 2026-07-11

## Context

The release workflow versions the package with Changesets and tags it, but it did
not attach any build to the GitHub Release, and the store publish jobs referenced
zips that no step produced. Three gaps had to close before a first release: the
package is marked private, which by default excludes it from Changesets tagging; the
Firefox Add-ons review requires a source package that rebuilds the extension; and the
release had to carry the Chrome zip, the Firefox zip, and that source package.

The package is `private` so it is never published to npm. Changesets resolves an
absent `privatePackages` key to `{ version: true, tag: false }`, so `changeset tag`
skipped the package and produced no tag, which left the release output `published`
false and the whole release path inert.

A tag pushed by the workflow with the built in token does not trigger another
workflow run, by design, so a separate tag triggered job to build artifacts would
never fire.

## Decision

Set `privatePackages` to `{ version: true, tag: true }` in the Changesets config, so
the private package is versioned and tagged while staying excluded from npm publish.

Build and attach artifacts inside the same release job, gated on the tag being
created. After the Changesets step, when a version was published, the job runs
`wxt zip -b chrome` and `wxt zip -b firefox` and attaches the Chrome zip, the Firefox
zip, and the Firefox sources zip to the release the Changesets action created for the
tag. This keeps artifact creation on the run that produced the tag rather than relying
on a tag triggered workflow that the token would suppress.

Guarantee the sources zip excludes private working material by construction. WXT drops
hidden paths and dependencies from the sources by default; the config adds explicit
`zip.excludeSources` globs for the non hidden private material (`CLAUDE.md`, `temp`)
and restates the hidden ones, so a leak cannot depend on remembering to delete a file
before packaging. Named scripts `zip:chrome` and `zip:firefox` produce the artifacts,
and the second also emits the sources zip that the README build section rebuilds.

Add a `wxt zip` step to each gated store publish job, so the automated submit path is
correct for later releases even though the first submission is manual.

## Alternatives considered

A separate tag triggered workflow to build artifacts was rejected because the built in
token does not trigger it. Leaving the package tagging default and hand tagging the
release was rejected because it splits the release truth between the workflow and a
manual step. Relying only on WXT's default sources exclusions was rejected because the
defaults cover hidden paths and dependencies but not the non hidden private files this
repository keeps, so an explicit exclude list is the honest guarantee.

## Consequences

A push that consumes the version PR tags the release and attaches all three artifacts
in one run. The sources zip rebuilds the Firefox zip and excludes private material by
construction. The store publish jobs stay gated behind their environments; the first
submission is manual, and the zip steps make later automated submits work without more
changes.
