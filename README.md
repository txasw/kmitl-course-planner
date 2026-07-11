# Course Planner for KMITL

A cross browser extension that turns the KMITL registration course search into
an interactive weekly timetable planner. It reads the same public course data
the registration site already uses, removes the duplicate rows the site repeats
across curriculum groupings, and presents the result as a drag and drop weekly
grid with conflict detection, saved plans, and image export.

The extension is read only with respect to the host site. It never touches
authentication, never submits forms, and never performs registration actions.

Course Planner for KMITL (KCP) is an independent tool built by a student. It is
not affiliated with, sponsored by, endorsed by, or officially connected to King
Mongkut's Institute of Technology Ladkrabang (KMITL). It reads only the public
course data the registration site already exposes.

## Status

Version 1.0.0. The store listings are being prepared. Until they are live, install the
unpacked build as described below.

## Install

Once published, install from the store listings:

- Chrome Web Store: link to be added
- Firefox Add-ons: link to be added

To run it now, on any Chromium browser or Firefox, use the zips from the latest release
(or build them, see Building from source):

- Chrome or Edge: open the extensions page, enable developer mode, and use Load unpacked
  on the unzipped Chrome build.
- Firefox: open `about:debugging`, choose This Firefox, and use Load Temporary Add-on on
  the unzipped build's `manifest.json`.

The planner runs only on the registration site at `regis.reg.kmitl.ac.th`.

## Requirements

- Node 24, pinned in `.nvmrc`. The `engines` floor in `package.json` is 20.19, but the
  build, the tests, and the release run on Node 24.
- pnpm 10.12.1, pinned in the `packageManager` field. Enable it with `corepack enable`.

## Getting started

```
pnpm install
pnpm dev            # Chrome and Chromium browsers
pnpm dev:firefox    # Firefox
```

`pnpm dev` starts the development build with hot reload. Load the unpacked
extension from the `.output` directory in your browser to try it against the
live registration site.

## Building from source

These are the exact steps to reproduce the release build, including the Firefox zip that
the Add-ons review rebuilds from the source package. The commands assume a clean checkout
of the source and nothing else.

Toolchain:

- Node 24 (the version in `.nvmrc`; the Firefox Add-ons reviewer default of Node 24
  matches). The `engines` floor is 20.19.
- pnpm 10.12.1, pinned in the `packageManager` field. Use corepack so the pinned version
  runs rather than a separately installed pnpm.

Steps:

```
corepack enable
pnpm install --frozen-lockfile
pnpm zip:firefox      # writes the firefox zip and the sources zip to .output
pnpm zip:chrome       # writes the chrome zip to .output
```

`pnpm zip:firefox` produces `.output/kmitl-course-planner-<version>-firefox.zip` and
`.output/kmitl-course-planner-<version>-sources.zip`. The shipped icons are committed
PNGs, so the build does not run the icon rasterizer; regenerate them only after editing
`assets/icon.svg`, with `pnpm icons`.

On Windows, if `pnpm install` fails with `ERR_PACKAGE_IMPORT_NOT_DEFINED` for a
`#module-sync-enabled` specifier, it is a known interaction between pnpm's symlinked
`node_modules` and the Node module resolver on Windows. Add a `.npmrc` with
`node-linker=hoisted` and install again. Linux, the continuous integration build, and the
Firefox Add-ons review are unaffected, since they resolve the symlinked layout correctly.

## Common tasks

```
pnpm typecheck      # TypeScript, no emit
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm test           # unit and component tests
pnpm test:e2e       # Playwright
pnpm build          # production build for Chrome
pnpm build -b firefox
pnpm zip:chrome     # package the Chrome build
pnpm zip:firefox    # package the Firefox build and the AMO sources zip
pnpm icons          # regenerate the icon PNGs from assets/icon.svg
```

## Project layout

- `src/entrypoints` background service worker and the content script UI
- `src/features` interface features (shell, search, catalog, planner, plans)
- `src/lib` framework free domain logic, validation, storage, and utilities
- `tests` fixtures and end to end specs
- `docs/adr` architecture decision records

## Privacy

No data leaves the browser. See [docs/PRIVACY.md](docs/PRIVACY.md) for the list
of permissions and the reason for each.

## License

MIT. See [LICENSE](LICENSE).
