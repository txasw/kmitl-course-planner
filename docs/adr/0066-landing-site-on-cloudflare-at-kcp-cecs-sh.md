# 66. Landing site on Cloudflare at kcp.cecs.sh

Status: Accepted
Date: 2026-11-07

## Context

The extension is listed on the Chrome Web Store and on Firefox Add-ons, but neither listing is a
page the project controls. A student who hears about the planner searches for it by the name
people use for it, KCP KMITL, and today that search reaches a store page at best, which cannot
show the dedupe problem, the conflict checks, or the exports at a useful size, and cannot answer
the questions students ask before installing: is it official, does it register for me, does it
work on a phone, where does my data go.

The project also plans a web version that would run without an extension, possibly behind a
reverse proxy. Students should be able to see that it is coming without being promised a date.

The project already holds the material such a page needs. The fixtures are real captures of the
registration API, the product renders them, and the e2e harness can drive the built extension
against a replica of the host with those fixtures. The owner holds the domain cecs.sh, and its
DNS zone is on the owner's Cloudflare account.

## Decision

A static landing site lives in `site/` and is served by Cloudflare Workers static assets at
https://kcp.cecs.sh/, in Thai at `/` and in English at `/en/`. Each page declares its canonical
URL and the Thai, English and default language alternates, and the sitemap lists both with the
same alternates.

`wrangler.jsonc` at the repository root describes the deployment: a Worker named `kcp-landing`
with no script, `assets.directory` set to `./site`, `html_handling` set to `auto-trailing-slash`
so `/en` resolves to `/en/`, `not_found_handling` set to `404-page` so an unknown path answers
404 with the bilingual not found page nearest it, `404.html` led in Thai at the root and
`en/404.html` led in English under `/en/`, and one route, `kcp.cecs.sh`, attached as a custom domain. The
`workers.dev` address and preview URLs are off, so the pages are public at one address only and
are never indexed twice. The owner deploys it, either through Workers Builds connected to the
repository with no build command and `npx wrangler deploy` as the deploy command, or by running
`npx wrangler deploy` from the repository root. Because the zone is on the same account, Wrangler
creates the DNS record for the custom domain. The repository holds no deploy workflow and no
Cloudflare credentials.

Response headers live in `site/_headers`, which Cloudflare reads at deploy and never serves.
Every path gets a Content Security Policy that allows scripts, styles, images, fonts and fetches from the
site itself only, with `default-src 'none'`, no inline script or style, and
`frame-ancestors 'none'`, plus Strict-Transport-Security, `X-Content-Type-Options: nosniff`, a
strict-origin-when-cross-origin referrer policy, a Permissions-Policy that turns off every
feature the page does not use, and a same origin opener policy. The pages are revalidated on
every visit. The stylesheet, the script and the screenshots are cached for a year as immutable,
which is safe because `pnpm site:build` names each of them in the pages with a hash of its
content; the font never changes in place, and a new subset would take a new file name.
`site/_redirects`, which Cloudflare also reads and never serves, sends a guessed `/th/` address
to the Thai page at the root.

Discovery is the first goal. Both titles and the first heading lead with KCP, the structured data
names the product with the alternate names KCP KMITL and ตัววางแผนตารางเรียน สจล., and it lists
both store install URLs, which also appear as plain links in the hero, the download band and the
footer. The structured data carries no rating or review, because any figure would be invented.

The page carries no telemetry. It sets no cookies, loads no analytics, and requests nothing from
another origin: the display face, a subset of IBM Plex Sans Thai SemiBold renamed KCP Display as
its license requires, the stylesheet, the script and every image are served from the site
itself. The one script is deferred and optional: it adds the merge toggle to the dedupe table
and marks a Firefox visitor so the Firefox button is the filled one, and the page is complete
without it.

The screenshots are generated from the real build. `pnpm site:shots` runs a Playwright config of
its own, which CI does not run, that loads the built debug extension against the e2e host
replica with fixture data, builds the hero plan through the panel as a student would, and saves
each state in both languages. The debug build is used because only its open shadow root lets the
locators reach the panel; the capture hides its diagnostics control before every shot, the one
visible difference from the production build. A new plan takes a Thai default name in either
language, so the English run renames it through the plan menu. The exported posters are the
files the product downloads. One state is staged: the revalidation dialog, made by writing an
older time into a saved snapshot so the real reconcile path finds a change, and its caption
claims no real change. `pnpm site:encode` turns the masters into AVIF and WebP at the widths
the layout needs, without editing pixels; no JPEG is kept, because every browser that reads the
picture element reads WebP, which trims about a fifth of the image bytes. Then
`pnpm site:build` renders both pages, the not found page, the sitemap and the favicons.
The dedupe table on the page is generated from the category search capture with the product's
own hashColor, so it is never typed by hand and its colours match the screenshots.

The web version appears as a third control beside the two store buttons. It is a button marked
aria-disabled with a visible note that it is in development with no date, not a link, so it is
never a dead link and collects nothing. When the web version ships, the same slot becomes a
link and the layout does not change.

## Alternatives considered

GitHub Pages. It needs no account beyond the repository, but it cannot set response headers, so
the policy would move to a meta tag, which cannot carry `frame-ancestors`, and it cannot host
the reverse proxy the web version may need. The owner rejected it in favour of the Cloudflare
account that already holds the zone.

Cloudflare Pages. It serves the same `_headers` file, but Cloudflare now directs new static
sites to Workers static assets, which is also where a reverse proxy Worker for the web version
would live, on the same account and under the same configuration format.

A framework site, for example a static site generator with client islands. It would make the
pages easier to template but adds a runtime, a build in the deploy path and dependencies to keep
patched, for a site of two pages. A small Node script that renders plain HTML covers the same
need with no client runtime, and the deploy uploads the committed output as it is.

The store listings only. They cost nothing to keep, but they cannot rank for KCP KMITL on their
own, cannot carry the bilingual explanation or the honest answers about phones and the web
version, and show screenshots at a size that hides the product's detail.

## Consequences

The landing images are regenerated by hand when the product's look changes: run
`pnpm site:shots`, which builds the debug extension first, then `pnpm site:encode` and
`pnpm site:build`, and review the images. The version on the page is read from package.json when
`pnpm site:build` runs, so the site is rebuilt after a release that should show a new version.
The pages describe the features on main, which can run ahead of the released version while
changesets are pending, so the deploy follows the release: merge the release, wait until the new
version is live on both the Chrome Web Store and Firefox Add-ons, run `pnpm site:build` so the
page and the structured data state that version, and only then deploy. Workers Builds deploys on
every merge to main, so it is connected only once the released version matches what main
describes, or the order above is kept by deploying by hand. `pnpm site:build` warns while minor or
major changesets are pending, as a reminder; it does not fail, since pending changesets are the
normal state between releases.
Any edit to the stylesheet, the script or an image needs `pnpm site:build` before it is
committed, so the hashed references move with it; the site test fails otherwise.

Deploying is an owner action outside CI. A reverse proxy Worker for the web version can later
share the account and the zone, for example at a path under kcp.cecs.sh, with its own ADR.

The owner verifies the domain in Google Search Console through a DNS TXT record on cecs.sh,
submits the sitemap, and sets the store listings' homepage to https://kcp.cecs.sh/.

A vitest suite over `site/` keeps the page honest: pages and a sitemap equal to what
`pnpm site:build` renders, titles, canonical and alternate links, the
structured data and its install URLs, the disabled web control, every internal link and image
present in the folder, content hashes that match the files, markup the policy allows, alt text
and dimensions on every image, no remote asset outside the stores, GitHub and the site itself,
no analytics, the same tone rules the extension's copy follows, a `wrangler.jsonc` that deploys
`./site` to the kcp.cecs.sh custom domain, the security and cache headers, and no GitHub Pages
configuration.
