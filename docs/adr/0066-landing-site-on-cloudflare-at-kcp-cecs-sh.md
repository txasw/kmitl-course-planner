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

## Amendment, 2026-11-08: the owner review of the landing page

The owner reviewed the first version and asked for four changes: cut the content that explains
how to use the product, add motion in the spirit of a product launch page, fix the phone layout
of the dedupe demonstration, whose toggle sat above 1,330 px of rows, and stop the text from
crowding every screen.

Content. The page now holds one idea per screen. The search, conflict, narrow window, suggestion
and getting started sections are gone, with six of the ten FAQ entries; each remaining feature is
one headline with one line under it, and the main text without the dedupe table and the story
grid fell from about 8,100 to about 2,250 Thai characters and from about 1,600 to about 420
English words, and each fact is said once: the touch note shows once in each install row and only on a coarse pointer, the
footer disclaimer is one sentence, and the FAQ answers only what the body does not. Ten screenshots are cut from the shot list and their capture steps removed; the
kept masters are re-encoded without a recapture. Spacing runs on one scale of section, media, sub
line and call to action gaps.

The story. One dark section replaces the conflict screenshots: a timetable built in HTML from plan
H, which now lives in `scripts/landing/story-plan.mjs` for both the capture and the page.
`storyBlocks` reads the exam capture for every block's day, times, name, section and credits, and
the clash, so nothing in the grid is typed by hand. Blocks are placed by day, hour and span
classes the stylesheet defines for each orientation, days as rows from 640 px and as columns
below, as ADR-0043 orients the product. Every block leads with its subject id and shows its name
under it where the page may; 01006021, whose Thai name holds a reserved term, shows its id alone in
both languages, and a phone, whose day columns would break Thai names inside words, labels every
block by its id. The dedupe statement quotes the same category sample the table under it shows,
from `dedupeCounts`, so the claim and the proof are one sample.

Motion. This reverses the first version's still page. `site.js` now loads in the head, before the
stylesheet and without defer, and sets `.motion` unless the reader prefers reduced motion and
`.no-sda` where the browser has no scroll driven animations, so every hidden start state exists
before the first layout. Without the script, or with reduced motion, every block renders its
final state; a site test fails if any rule outside `.motion` sets opacity 0 or a transform. Only
transform and opacity animate, rows and blocks move inside boxes that keep their size, and
measured cumulative layout shift is 0. Path A, in Chrome, Edge and Safari 26, scrubs the reveals,
the hero frame, the plate parallax and the closing band on a scroll or view timeline; path B,
elsewhere, plays the same end states with transitions from classes that intersection observers
set, with no scroll listener anywhere. The two pinned scenes, the dedupe merge and the three beat
timetable story, step on their own clock in both paths, as the pacing note below records. Pinned
progress comes from zero height sentinels, each placed one header height above its point and
watched by an observer whose band runs from far above the window down to its top edge, with
margins in pixels and percentages only: setting them up reads no size and forces no layout, and a
fast scroll that jumps a sentinel past the edge in one frame still changes its state.

The dedupe table is now a set of fixed height grid rows on a stage card, two short lines a row on
a phone. Each row carries its raw index and its section's slot, and the merge moves it by
`translateY((slot - index) * row height)`; the earlier fold, which animated row height, is
removed. The merge runs in two steps so no two texts share a place at partial opacity and the
counter always names what the table shows: the repeats fade where they stand while the counter
turns from rows to sections, then the sections close up and each label swap empties its box
before the next text enters. The stage card is drawn as a head, a body that folds away and a foot
that rises, so it shrinks to the merged rows by transforms alone. The stage pins on any window at
least 540 px tall, with 34 px and then 26 px rows on shorter windows. The merge toggle the first
version added is removed too, because the scroll already
plays the merge. Without the motion the table rests in its merged state: the four sections with
the chips that count their listings, under a counter that names both numbers. The repeat rows
are hidden from assistive technology in every state and the caption states the merged count in
text, so a screen reader always hears the same result the page shows at rest.

Browser marks. The install buttons first carried a generic extension glyph, then a labelled
Firefox button with the Firefox logo beside a Chrome button with its label alone. The owner then
chose the stores' own badges: both install rows, in the hero and the closing band, are now Google's
Available in the Chrome Web Store badge and Mozilla's Get the add-on badge. Google lets a site use
its badge without approval when the badge links to the item's page in the store, is changed in no
way but resizing in proportion, stays legible and fully visible, keeps some distance from other
logos and is not the page's primary element. Mozilla offers its badge, as two PNG sizes and an SVG,
to link to the add-on's listing on addons.mozilla.org. The files were downloaded once and are
served from `site/assets/brand/` under a content hash like every other asset: the SVG for Mozilla,
and for Google the largest PNG of the bordered variant, 496 by 150, since Google publishes no SVG
and its three PNG sizes differ in proportion, so a srcset across them would change the badge's
shape between screens. The bordered variant keeps an edge on the grey closing band as on white.
Neither store publishes a Thai badge, so both pages show the English ones, each with the lang
attribute set to English and alt text equal to the badge's own words, so the link is named by what
it shows. Both badges render at one height, 56 px, or on a narrow phone the height at which the
pair fits one row with 12 px between them. A Firefox visitor sees the Firefox badge first. The web
version stays as a quiet pill of the same height after the pair, the touch note follows the badges
on a coarse pointer, and the Firefox logo file the earlier button used is removed. The footer's
trademark sentence names Chrome, the Chrome logo and Chrome Web Store as Google's, and Firefox and
the Firefox logo as Mozilla's, since both badges carry those marks. The guidelines this relies on:

- https://developer.chrome.com/docs/webstore/branding
- https://www.mozilla.org/en-US/foundation/trademarks/policy/
- https://extensionworkshop.com/documentation/publish/promoting-your-extension/

Pacing. Readers who scroll fast found the pinned moments over too soon, so each scene now holds
still between its changes, and the extra length stays inside the pinned scenes. The hero frame
stands up over three quarters of a screen and then holds. The dedupe stage holds its thirteen
rows, merges, and holds the merged sections for the last quarter of a track one and a half
screens long. The story track is four screens long on a laptop: its grid draws while the dark
band rises, and each beat holds fully readable before the next starts. Path B mirrors the holds
through its sentinel positions. Scroll snapping was rejected because it fights a reader who wants
to move on. Outside the pinned scenes the sections share one gap that grows with the window
height, from 96 px to 144 px, and the statement screens no longer fill a whole window each.

Fast scrollers. Scrubbing still let a fast flick blur the pinned scenes: measured with CDP scroll
gestures at 3,000 to 6,000 px/s, each story beat was fully visible for 16 to 116 ms and the merged
dedupe state for 17 to 200 ms. Both scenes now step when the scroll crosses each of their lines:
`site.js` moves `data-step` one step at a time, each step plays its transitions in about a second
on its own clock, and a queued step waits until the one before has finished and held for 600 ms,
so a reader who flicks and stops anywhere in a scene sees every step whole, in order. Scrolling
back steps down the same way with short reverse transitions. Measured again with the same
gestures, a flick that stops inside the dedupe track shows the first step for about 1.4 s and then
the merged state for the rest of the window, and a flick that stops inside the story shows each
beat it passes for about 0.9 s before the next, then holds the current one. A flick that passes a
whole scene in under half a second now sees none of it rather than a blur, which is the trade the
owner chose. The long tracks and their rest ranges stay, the story now pins on any window at least
540 px tall with rows sized from the window height, and the dark band rises over the end of the
dedupe track so the page turns dark while the reader is still moving. Proximity scroll snapping
was tried again with snap points at each rest and rejected: a slow wheel scroll that came near a
point was pulled back to it on every notch and could not move on. Smooth scrolling is dropped for
the same reason it hurt here: a focus move or a section link ran through several screens of pinned
track and played every scene in fast forward.
