# Store listing

This document holds the store descriptions, the screenshot plan, and the steps to
acquire the publishing credentials. It is finalized in the release readiness
phase. The sections below are placeholders.

## Descriptions

- Short description: to be written.
- Full description: to be written.

## Screenshot plan

- Launcher on the registration site.
- Search and catalog with the deduplicated course list.
- Weekly grid with a placed schedule.
- Conflict feedback during a blocked placement.
- Preview mode poster with the export toolbar.

## Publishing credentials

Publishing stays behind manual approval until the first listed release. The
release workflow reads these as environment secrets, scoped to the gated
`chrome-web-store` and `amo` environments.

### Chrome Web Store

Configure the following secrets. Acquire them from the Chrome Web Store API
setup for a service account or OAuth client:

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

### Firefox AMO

Configure the following secrets from the AMO API key page, along with the gecko
add-on id recorded in the manifest:

- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`
