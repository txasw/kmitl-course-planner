# KCP: Course Planner for KMITL

KCP is a browser extension that turns the KMITL registration course search into an
interactive weekly timetable planner.
KCP คือส่วนขยายเบราว์เซอร์สำหรับจัดตารางเรียนและวางแผนลงทะเบียนเรียนของ สจล. (KMITL)
บนตารางรายสัปดาห์ จากข้อมูลรายวิชาที่เปิดสอน

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/bkjijmajieoojchaknjdpbkaomnofnef)
  for Chrome, Edge, Brave, Opera, and other Chromium browsers
- [Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/course-planner-for-kmitl/)
  for Firefox
- [Project site at kcp.cecs.sh](https://kcp.cecs.sh/)

KCP reads the same public course data the registration site already uses, removes the
duplicate rows the site repeats across curriculum groupings, and presents the result as
a drag and drop weekly grid with conflict detection, saved plans, and image export.

The extension is read only with respect to the host site. It never touches
authentication, never submits forms, and never performs registration actions.

KCP: Course Planner for KMITL is an independent tool built by a student. It is not
affiliated with, sponsored by, endorsed by, or officially connected to King Mongkut's
Institute of Technology Ladkrabang (KMITL). It reads only the public course data the
registration site already exposes.

## Install

Install KCP from the store for your browser:

- Chrome, Edge, Brave, Opera, and other Chromium browsers:
  [Chrome Web Store](https://chromewebstore.google.com/detail/bkjijmajieoojchaknjdpbkaomnofnef)
- Firefox:
  [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/course-planner-for-kmitl/)

Each store reviews a new version on its own schedule, so an update can reach one store
before the other. Release notes for every version are in [CHANGELOG.md](CHANGELOG.md) and
on the [releases page](https://github.com/txasw/kmitl-course-planner/releases).

After installing, open the registration site at `regis.reg.kmitl.ac.th` and select the
Planner launcher in the bottom right corner. From version 1.4.0, the toolbar icon and the
shortcut Alt+Shift+P (Option+Shift+P on macOS) also open the planner. On a registration
page they open the panel in place; on any other tab they open the registration search
page with the panel.

### Unpacked install for development or testing

To try a release build or a local build without the store, use the zips from the
[releases page](https://github.com/txasw/kmitl-course-planner/releases), or build them as
described in Building from source:

- Chromium browsers: open the extensions page, enable developer mode, and use Load
  unpacked on the unzipped Chrome build.
- Firefox: open `about:debugging`, choose This Firefox, and use Load Temporary Add-on on
  the unzipped build's `manifest.json`. A temporary add-on is removed when Firefox
  restarts.

## Requirements

- Node 24, pinned in `.nvmrc`. The `engines` floor in `package.json` is 22.22.1, but the
  build, the tests, and the release run on Node 24.
- pnpm 10.12.1, pinned in the `packageManager` field. Enable it with `corepack enable`.

## Getting started

```
pnpm install
pnpm dev            # Chrome and Chromium browsers
pnpm dev:firefox    # Firefox
```

`pnpm dev` builds the extension with hot reload and launches a separate browser profile
with it already loaded. The development build is the debug flavor: its name carries the
(Debug) suffix and the panel includes the diagnostics drawer. Each fresh development
profile shows the install welcome. To load the development build into an existing
browser profile instead, use Load unpacked on `.output/chrome-mv3-dev` (or
`.output/firefox-mv3-dev` for Firefox).

## Building from source

These are the exact steps to reproduce the release build, including the Firefox zip that
the Add-ons review rebuilds from the source package. The commands assume a clean checkout
of the source and nothing else.

Toolchain:

- Node 24 (the version in `.nvmrc`; the Firefox Add-ons reviewer default of Node 24
  matches). The `engines` floor is 22.22.1.
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
pnpm build          # production build for Chrome
pnpm build -b firefox
pnpm build:debug    # debug flavor build for Chrome
pnpm zip:chrome     # package the Chrome build
pnpm zip:firefox    # package the Firefox build and the AMO sources zip
pnpm icons          # regenerate the icon PNGs from assets/icon.svg
```

The end to end suite loads the built extension, so build both flavors and install the
Playwright Chromium first:

```
pnpm exec playwright install chromium
pnpm build
pnpm build:debug
pnpm test:e2e       # Playwright projects: smoke, debug, production, phone, tablet
```

The smoke project checks the production manifest, the production project runs against
`.output/chrome-mv3`, and the debug, phone, and tablet projects run against
`.output/chrome-mv3-debug`.

## Project layout

- `src/entrypoints` background service worker and the content script UI
- `src/features` interface features (shell, search, catalog, planner, plans,
  onboarding, and the debug only diagnostics drawer)
- `src/components` shared presentational components
- `src/lib` framework free domain logic, validation, storage, and utilities
- `tests/e2e` end to end specs and their mock host and API server
- `tests/fixtures` captured API responses and regression payloads
- `tests/scripts` unit tests for the repository scripts and the manifest
- `tests/support` and `tests/setup.ts` shared test helpers and setup
- `docs/adr` architecture decision records

## Privacy

No data leaves the browser. See [docs/PRIVACY.md](docs/PRIVACY.md) for the list
of permissions and the reason for each.

## License

MIT. See [LICENSE](LICENSE).
