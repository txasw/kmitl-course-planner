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

Under active development. The public store listings are not yet available.

## Requirements

- Node 24 (see `.nvmrc`)
- pnpm 10 (the version is pinned in `package.json`)

## Getting started

```
pnpm install
pnpm dev            # Chrome and Chromium browsers
pnpm dev:firefox    # Firefox
```

`pnpm dev` starts the development build with hot reload. Load the unpacked
extension from the `.output` directory in your browser to try it against the
live registration site.

## Common tasks

```
pnpm typecheck      # TypeScript, no emit
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm test           # unit and component tests
pnpm test:e2e       # Playwright
pnpm build          # production build for Chrome
pnpm build -b firefox
pnpm zip            # package a build for store upload
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
