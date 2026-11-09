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
under it where the page may; the Thai name of 01006021 holds a reserved term, so the page names it
with the host's own word for that term, ปฏิบัติฟิสิกส์ทั่วไป 1 (docs/TERMINOLOGY.md), and a phone,
whose day columns would break Thai names inside words, labels every block by its id. The dedupe statement quotes the same category sample the table under it shows,
from `dedupeCounts`, so the claim and the proof are one sample.

Motion. This reverses the first version's still page. `site.js` now loads in the head, before the
stylesheet and without defer, and sets `.motion` unless the reader prefers reduced motion and
`.no-sda` where the browser has no scroll driven animations, so every hidden start state exists
before the first layout. Without the script, or with reduced motion, every block renders its
final state; a site test fails if any rule outside `.motion` sets opacity 0 or a transform. Only
transform and opacity animate, rows and blocks move inside boxes that keep their size, and
measured cumulative layout shift is 0. Path A, in every browser with scroll driven animations,
which includes Chrome, Edge, Safari 26 and current Firefox (the Firefox 159 that Playwright drives
runs path A), scrubs the reveals, the hero frame, the plate parallax and the closing band on a
scroll or view timeline; path B, the fallback for a browser without scroll driven animations,
plays the same end states with transitions from classes that intersection observers set, with no
scroll listener anywhere. The two pinned scenes, the dedupe merge and the three beat
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
it shows; Mozilla's words name no browser, so its alt text reads Get the add-on for Firefox. Both
badges render at one height, 56 px, or on a narrow phone the height at which the pair fits one row
with 12 px between them, measured against the install row itself with 4 px to spare, since Firefox
rounded a badge a fraction of a pixel wider and wrapped the pair at 320 px. A Firefox visitor sees
the Firefox badge first: `site.js` moves it before the Chrome badge in the document as the parser
inserts it, before any paint, so focus reaches the badges in the order they show and nothing
shifts; the stylesheet never reorders them on screen alone. The touch note follows the badges on a coarse pointer, and the web version
waits on a line of its own under the pair as a smaller pill, 40 px tall with a dashed edge and a
grey coming soon label, so the two badges read as the primary pair. The Firefox logo file the
earlier button used is removed. The footer's
trademark sentence names Chrome, the Chrome logo and Chrome Web Store as Google's, and Firefox and
the Firefox logo as Mozilla's, since both badges carry those marks. The guidelines this relies on:

- https://developer.chrome.com/docs/webstore/branding
- https://www.mozilla.org/en-US/foundation/trademarks/policy/
- https://extensionworkshop.com/documentation/publish/promoting-your-extension/

Pacing. Readers who scroll fast found the pinned moments over too soon, so each scene now holds
still between its changes, and the extra length stays inside the pinned scenes. The hero frame
stands up over three quarters of a screen and then holds. The dedupe stage holds its thirteen
rows, merges, and holds the merged sections for the rest of a track one and three quarter
screens long. The story track is four screens long on a laptop and a phone: its grid draws while
the dark band rises, and each beat holds fully readable before the next starts. Path B mirrors the holds
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

Steady scrollers. The fixed clock then failed the most common reader, one who scrolls steadily
without stopping. Every step cost its whole transition and a 600 ms hold whatever the speed, so at
500 to 850 px/s the steps trailed the scroll: measured with CDP constant speed gestures in
Chromium, the merged dedupe state was fully visible while pinned for 0 ms at 500 and 850 px/s on
both a 1440 by 900 and a 390 by 844 window, and the third story beat for 0 ms at 850 px/s on both,
and at 500 px/s on the phone, where it finished after the pin let go. A reader who stopped between
the two dedupe lines rested on a card the repeats had left half empty. The pace now follows the
reader, still without a scroll listener. Each line has a gate a little before it, and the
intersection observer's own entry time says how long the reader took between the two: a reader
who crosses both within 250 ms, a few hundred px/s or more, is scrolling on. So is one who had
already crossed the next line when a step finished. For that reader a step plays at 0.45 of its
length, its transitions scaled by a --pace property `site.js` sets through the CSSOM, and the next
step follows 100 ms after it. A reader who stops gets each step at full length, and a line crossed
after a step finished still waits out a 650 ms hold, so the finished step stays in view. The
dedupe plays both of its steps from its first line, the close up after the hold, so no stop shows
a half empty card; its second line only marks a reader who has moved on. The dedupe lines move from
0.16 and 0.32 to 0.08 and 0.18 of a track 25svh longer, the story lines from -0.15, 0.34 and 0.65
to -0.15, 0.23 and 0.58, and the phone story track grows from 340svh to the laptop's 400svh, so
the page is about 225 px longer on a laptop and about 720 px, some 6 percent, on a phone.
Measured again with the same gestures, every end state, the merged dedupe and each of the three
beats, is fully visible while pinned for at least 650 ms at 300, 500, 800 and 850 px/s on both
windows, and at 800 px/s the merge completes with more than 40 percent of its pinned track still
ahead and the third beat by three quarters of its track. A
4,000 px/s flick that stops inside a scene plays it to its end at the quick pace; a flick that
passes a whole scene in under half a second still sees none of it. Firefox, driven by wheel
events, steps the same way.

Short phones, the lead in and jumps. A second measurement, settle aware (`data-step` at its end
state, no transition running but the blocker pulse, the parts inside the band under the header),
found three gaps. A track sized in screens alone gives a short phone little scroll: at 375 by 553
the dedupe track pinned for about 970 px and the story for about 1,715 px, so at 850 px/s the
merged card was fully visible for 50 ms in Chromium and 82 ms in Firefox, beat two for 116 ms and
beat three for 67 ms, and 360 by 640 showed beat three for 0 ms. Each track now keeps a pixel
floor under its screen length: the dedupe pins for max(175svh, 1,500 px) and the story for
max(three screens and a header, 2,800 px), on a tablet two and seven tenths screens and a header.
Second, a reader who stopped between the dedupe lines saw the repeats fade and then a 650 ms hold
on the half empty card before the close up, and the merge was still moving 1.5 s after the first
line. The fade is now a lead in step: it plays at 0.65 of its length, the close up follows 100 ms
after it at 0.75 of its length, and the merge completes about 1.4 s after the first line, with the
counter still turning from rows to sections as the repeats fade. Third, a jump that crossed every
line at once, an anchor link, a restored scroll position or the End key, chained all the steps,
and beat three was still moving 1.5 s later. A crossing that passes a line together with its gate,
or several lines, in one frame now sets the passed steps at once, their transitions at zero
length, and plays only the last at full length, so a jump into the story settles in about 1.3 s.
For margin the quick pace drops from 0.45 to 0.4, the dedupe lines move to 0.05 and 0.15 of the
track and the story lines to -0.15, 0.24 and 0.6. Measured again with the same probes, every end
state, the merged dedupe and each beat, is fully visible while pinned for at least 750 ms in
Chromium and 687 ms in Firefox at 300, 500 and 850 px/s on 1440 by 900, 390 by 844, 375 by 553 and
360 by 640 windows. The floors lengthen the Thai page by about 36 px on a laptop, 235 px on a
390 by 844 phone, 1,620 px at 375 by 553 and 1,200 px at 360 by 640 and 320 by 640.

The closing band. Its heading and badges rose on the band's own view timeline over a range that
ended halfway through the band's cover, so a reader at rest with the band in view found the
heading at about half strength and the badges short of full. They now rise on their own view like
every revealed block and stand at full strength once their top is 85 percent down the window, and
the band clips its glow with `overflow: clip`, which unlike `overflow: hidden` makes it no scroll
container that would capture that view.

## Amendment, 2026-11-09: holds that keep moving and scenes that leave on purpose

The owner found that a slow scroll through a pinned hold changed nothing for a long stretch, so
the page looked frozen: on a 375 by 553 phone the merged dedupe card held for about 1,100 px,
3.6 s at 300 px/s, and the story held between its beats and after the third. A scene that let go
also just slid away. Five changes answer that, and none of them touches the steps' own clock.

The scene meter. Each pinned stage carries a meter at its foot, decoration hidden from assistive
technology and holding nothing that takes focus: a 200 px rail that fills across the scene's
pinned scroll, with a mark at each step line that fills once its step has played. In path A the
rail fills on the track's own view timeline, measured below the header with
`view-timeline-inset`, so its contain range is exactly the pinned scroll, and each mark grows as
the scroll nears it, a hint that the next beat is close. In path B the rail fills from 61 zero
height sentinels per track, at sixtieths of the pinned scroll and watched like the step lines,
with a 250 ms transition from one point to the next, so it moves every 22 to 47 px of scroll. The
dedupe meter shows only once the merge has played, since the thirteen rows reach the foot of a
short window. During the long merged hold path A also fills each section's chip, the one that
counts its curricula, with a deeper tint, one chip after another down the table; a first try drew
a line under each chip instead, which read as a link. Path B keeps the chips still.

The keep scrolling cue. When a step has finished, the scene is pinned and no progress point has
moved for one second, a 13 px label, เลื่อนต่อ or Keep scrolling, with a chevron drawn as inline
SVG fades in above the rail and the chevron bobs 3 px. The next point the scroll crosses, or the
next step, fades it out in 150 ms. Progress, rest and resumption all come from the same
sentinels, so the page still has no scroll, wheel or touch listener, and a site test now checks
all three. The cue stays away past nine tenths of a scene's pinned scroll, where the pin is about
to let go and the next section is coming into view, which also covers the last beat of the last
scene. Its text is #5c5c5c on white, 6.69 to 1, and #a1a1a6 on the story's #111113, 7.33 to 1.
Without the script or with reduced motion the scenes do not pin and the meter is not displayed,
which a site test checks. Measured in Chromium and Firefox at 1440 by 900 and 375 by 553, the cue
shows about a second after the step settles and is gone 250 ms after a 60 px wheel turn.

Designed exits. In path A each pin plays over the first 80 percent of its track's exit range,
which begins exactly where the pin lets go: the dedupe stage sinks 14svh slower than the page,
shrinks to 0.94 and dims to 0.2 while the dark band rises over it, and the story lifts 6svh
faster than its band, shrinks to 0.98 and dims to 0.2 as the next section comes up. In path B a
pin takes `.is-leaving` once the sentinel at its release point has crossed and eases to 0.35
opacity over 600 ms, on a clock, since only that point is known there. Both start at release, so
they take nothing from the pinned holds.

The short phone hold. The dedupe floor drops from 1,500 px to 1,300 px of pinned scroll. The
merge takes about 0.9 s at 850 px/s, so the shorter floor alone would have cut the merged hold
under the target; its first line therefore moves from 0.05 to -0.1 of the track, crossed while the
card rises its last stretch to the header, and its second from 0.15 to 0.05. Measured with the
round five probes, which now leave out animations on a scroll timeline and anything inside the
meter when they ask whether a scene has settled, and which now also require the pin at full
opacity, every end state, the merged dedupe and each beat, is fully visible while pinned for at
least 766 ms in Chromium and 717 ms in Firefox at 300, 500 and 850 px/s on 1440 by 900, 390 by
844, 375 by 553 and 360 by 640 windows, and every slow or jumping stop inside the dedupe track
rests on the merged card. The Thai page is 200 px shorter at 375 by 553, 360 by 640 and 320 by
640, 23 px shorter at 390 by 844, where 175svh is 1,477 px, and unchanged at 1440 by 900.

Three smaller fixes. The closing band's mark rose on the band's own view timeline over a range
that ended late, so at rest it sat at about two thirds strength under a heading already whole; it
now rises on its own view over the same range as the heading and the badges and is upright first,
since it sits above them. The web version pill sets its label at 14 px and its coming soon badge
at 13 px, still 40 px tall. Under 390 px the English headline sets its size from the window
width, `clamp(30px, (100vw - 40px) / 8.9, 40px)`, and keeps its second phrase on one line, so
"before you register." no longer leaves its last word alone at 320 to 375 px, with or without
the script; the English page is 50 to 70 px shorter there as a result.

## Amendment, 2026-11-09: content that moves through every hold

The rail and the cue did not settle the owner's point. A reader who scrolls slowly and does not
stop never sees the cue, and the rail, a 2 px hairline at the window's foot, was the only thing
that moved: on the story it advanced 6 to 7 px for each 100 px of scroll. Measured with a
reader's eye probe, which screenshots every frame of a continuous 150 and 300 px/s scroll,
averages each 4 by 4 pixel box in greyscale, counts a box as changed past 20 levels and a frame
as unchanged while no more than two boxes differ from the first frame of a stretch, allows 3 px
of vertical shift and masks the header and the meter, the content stood still for up to 601 px
of scroll in Firefox and 638 px in Chromium while pinned. Six changes answer that, and none of
them touches the steps' own clock.

Content that moves. Every hold now moves its content with the scroll, while the stepped end
state stays whole, in place and legible. On the merged dedupe card an orange ring reads down the
four sections: it rests on a row, then glides to the next, a white panel lights under the row it
rests on, and each row's chip, the count of its listings, keeps a thin ring once its row has
been read, so the card never returns to a state it has shown. On the story a ring visits the
placed blocks one after another under beat one and again under beat three, the landed section
last; before beat two a dashed slot brightens over the Tuesday morning the dragged section drops
onto, under beat two a red ring visits the clash and then the chip that names it, and a green
dashed slot brightens, dims a little and brightens again over the Wednesday afternoon it will
move to; under beat three a soft
panel lights behind the credit readout. Each item names its window as shares of the pinned
scroll, `--from` and `--to`. Path A plays it on the track's view timeline over that range, and
path B reads it from `--progress`, which `site.js` now sets on the pin from the same 61
sentinels and a 250 ms transition smooths. Every highlight is a ring, a panel or a dashed slot
on a pseudo element of its own that animates opacity and transform only, so no stepped
transition is touched and no text loses contrast. The chip tint of the previous round is
removed: it brought the chip's text under 4.5 to 1. A slow scale drift of the card and the grid
was left out, since a scaled layer can rest with soft text and a larger story grid would leave a
short window.

The rail. It is now 3 px tall and sits just under the scene's content, under the merged card and
under the timetable, instead of at the window's edge. Its width is a tenth of the track's pinned
scroll, which each track now names `--pinned` and also uses for its height, so both rails fill
at 10 px per 100 px of scroll, capped by the window on a narrow phone. The meter box hugs the
rail and the cue.

The cue. While it shows, the reader's first wheel, touch or key hides it at once, through
passive listeners on the window that exist only while the cue shows and are removed together by
one AbortController when it hides. A 4 px wheel turn, a key press or a tap starts its 150 ms
fade at once in Chromium and Firefox at 1440 by 900 and 375 by 553. The page still has no
scroll or touch move listener, and the site test now checks the nudge listeners in place of the
wheel rule.

Exits in path B. Path B is the fallback for a browser without scroll driven animations; the
Firefox that Playwright drives runs path A. Its exit no longer fades to 0.35 on a clock once the
pin lets go. Twelve more sentinels sit past each release, over the 80 percent of a window the
scroll driven exit uses, and `site.js` sets `--leave` from them, so the stage dims, shrinks and
moves at the pace of the scroll and a reader who stops just past the release is not left with a
ghosted card.

Reveals. A revealed block fades linearly with the scroll and only its rise keeps the long
exponential curve, and a short block takes at least 96 px of scroll, so the heading and sub after
the story no longer jump from about half to nearly full strength in one frame. The closing band
shares the range, so its heading and badges stand whole once their top is 96 px above the
window's foot when that is later than 85 percent down.

Shorter tails. The dedupe track pins for `max(150svh, 1300px)` instead of 175svh, so the merged
card no longer holds about 1.15 s at 850 px/s on a laptop. The story floor drops from 2,800 to
2,760 px with its lines at -0.15, 0.245 and 0.61, so the first two beats keep their pixel
positions and the stretch after beat three falls from 1,120 to 1,076 px. A cut to the 600 px a
700 ms hold alone would need was not possible: a reader at 850 px/s spends about 440 ms of that
stretch watching beat three play, and a trim to 1,055 px already measured beat three at 701 ms in
Chromium. The Thai page is 261 px shorter at 1440 by 900, 217 px at 390 by 844 and 40 px at
375 by 553, 360 by 640 and 320 by 640.

Measured again, the longest stretch of unchanged content while pinned, with the rail masked, was
172 to 195 px in Firefox and 135 to 168 px in Chromium across two independent runs at 150 and
300 px/s on 1440 by 900, 390 by 844 and 375 by 553 windows, against up to 601 px and 638 px
before, and no revealed block changes
its opacity by more than 0.3 in one frame. With the round five pacing probes, every end state,
the merged dedupe and each beat, is fully visible while pinned for at least 733 ms in Chromium
and 684 ms in Firefox at 300, 500 and 850 px/s on 1440 by 900, 390 by 844, 375 by 553 and
360 by 640 windows.

## Amendment, 2026-11-09: rows that light in place and writes that stay small

An independent review of the previous round passed its still stretch gate and found three faults
in what it added.

Rows that light in place. The ring that glided down the merged dedupe card straddled two rows for
about half of its window, so its top and bottom edges ran through row text, which on a card about
merged duplicates read as rows being struck out, and a reader who stopped mid glide was left
there with the keep scrolling cue under it. Path B moved it by a linear translate with no rests.
The gliding ring is gone. Each kept row carries its own orange ring on the white panel it
already lit, both on one pseudo element that never moves: in over the first 30 percent of a
window of 0.3481 of the pinned scroll, out over the last 30, one row every 0.2437, so the fall
of one row is the rise of the next and the last row is whole as the pin lets go. No edge can
cross text on the six column table or the compact phone rows, and a reader who stops anywhere
finds one row lit, or two faint ones while one hands on to the next. Path B fades the same
windows from the progress points with its 250 ms transition. Each chip takes its thin ring in
the middle of its row's rest, from 0.11 of the row's window for 0.075 of the pinned scroll.

Writes that stay small. `site.js` wrote `--progress` and `--leave` on the whole pin at each of
the 73 progress points, every 22 to 46 px of scroll, even in path A, where nothing reads them.
An inherited custom property set on the pin restyles the scene's whole subtree, and at a 4x CPU
throttle in Chromium the dedupe hold dropped up to 45 percent of its frames against under 3
percent in round six. Path A now writes neither. Path B writes `--progress` only on the rail fill
and the elements that host the highlights, the kept dedupe rows, the story cards, the ghost and
the readout, and `--leave` only on the pin, where `site.css` registers it with `@property` as a
number that is not inherited, so a new value restyles the pin alone; a write that would not
change its value is skipped. The site test checks that every element the stylesheet moves from
`--progress` is one of those followers or sits inside one.

One dip. The green slot over the Wednesday afternoon dimmed twice, to 0.45 halfway through its
window and to 0.6 at 85 percent, a flicker just before beat three lands. The second dip is gone,
so it brightens, dims a little and brightens again, as described, and stands whole for the last
30 percent of its window.

Measured with the same probes. At a 4x CPU throttle in Chromium, 300 and 850 px/s, 1440 by 900
and 390 by 844, path A dropped 0 to 2.2 percent of the frames in each hold over two runs, with a
95th percentile frame of 16.7 to 16.8 ms, against 5 to 92 percent and 33 to 50 ms for the
previous round and 0 to 2.8 percent for round six, apart from one 13 percent outlier, on the same
machine. Forced path B dropped 0 to 1.6 percent in every run but one, which dropped 5.7 and 6.6
percent and 0 and 0.5 percent when repeated. With the rail masked the longest stretch of
unchanged content while pinned is 27 to 166 px in Chromium and 109 to 199 px in Firefox across
two runs at 150 and 300 px/s on 1440 by 900, 390 by 844 and 375 by 553 windows, and at most
96 px in forced path B in Chromium; no revealed block changes its opacity by more than 0.3 in one
frame. With the round five pacing probes, every end state, the merged dedupe and each beat, is
fully visible while pinned for at least 733 ms in Chromium and 714 ms in Firefox at 300, 500 and
850 px/s on 1440 by 900, 390 by 844, 375 by 553 and 360 by 640 windows.
