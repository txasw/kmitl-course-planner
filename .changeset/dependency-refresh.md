---
'kmitl-course-planner': patch
---

Refresh dependencies to their latest minor and patch releases: the runtime @floating-ui/react
and lucide-react, and the tooling eslint, prettier, commitlint, and typescript-eslint. Force the
transitive build dependency adm-zip to 0.6.0 through a pnpm override to clear GHSA-xcpc-8h2w-3j85,
a high severity report against the 0.5 line; adm-zip is a Firefox tooling dependency and is not
shipped in the extension. No user facing behavior change.
