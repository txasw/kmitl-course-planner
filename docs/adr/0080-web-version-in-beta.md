# 80. Web version in Beta at kcp.cecs.sh/app

Status: Accepted
Date: 2026-11-28

Amends, for the web version only, brief section 6.9 on non goals, section 4.7 on API access,
and the security checklist of section 10.3. Amends ADR-0066, the landing site, which gains a
Worker script and a release deploy; ADR-0073, the version in the header, which the web version
replaces with Beta; and ADR-0075, quiet mode, for file locations only. Reviewed against rule 4,
no tech debt, rule 5, zero trust of external data, and rule 6 as the owner amended it on
2026-11-23.

## Context

The extension runs only where an extension can be installed. A student on an iPhone, in Chrome
on an Android phone, or on a computer where installing is not possible cannot use KCP, and the
landing site has shown a disabled web button marked Coming soon since ADR-0066.

The owner ruled on 2026-11-28:

- **Scope.** A trimmed web version with the three search tabs, the catalog, the grid with every
  placement and conflict rule, several plans kept in the browser, plan revalidation, the
  preview with PNG export for every template, copy image, copy as text, and JSON import and
  export. No registration helper and no diagnostics.
- **Location.** `https://kcp.cecs.sh/app/`, on the Worker `kcp-landing` that serves the landing
  site, with a Worker script that forwards a fixed set of public KMITL reads under `/api/`. The
  project opens it publicly without notifying the registrar.
- **Beta.** Every icon or button that leads to the web version carries the label Beta, and the
  web header shows Beta where the extension shows its version.
- **The current term.** The proxy also forwards `get-year-semester-now&level_id=1`, which the
  search uses for its default term (ADR-0053), with a 24 hour edge cache.
- **Deploy.** The landing site, the Worker, and the app deploy from the release workflow with a
  scoped Cloudflare API token, and Workers Builds stops.
- **Edge cache.** A teach table response is kept at the edge for 60 seconds.
- **Plan.** The Worker stays on Workers Free and answers busy when it is over its budget.
- **Releases.** Work continues as 1.7.x patch releases while the registration season lasts.

Before building, on 2026-11-28 at about 04:30 and with the owner's approval, one GET per public
endpoint was sent from a temporary `workers.dev` Worker on the project account, which was deleted
afterwards:

| Endpoint                              | Status | Body                                         | Time   |
| :------------------------------------ | :----- | :------------------------------------------- | :----- |
| `get-faculty`                         | 200    | JSON array of 23, 10 KB                      | 146 ms |
| `get-registrar-department`            | 200    | JSON array of 94, 23 KB                      | 46 ms  |
| `get-curriculum&LEVEL_ID=1`           | 200    | JSON array of 192, 207 KB                    | 56 ms  |
| `get-reference` (subject owners)      | 200    | JSON array of 17, 6 KB                       | 32 ms  |
| `get-year-semester-now&level_id=1`    | 200    | JSON object of five fields, 170 B            | 185 ms |
| `get-teach-table-show`, by subject id | 400    | the API's own JSON `{message, code, status}` | 31 ms  |

The teach table request carried only the mode, the term, and a subject id, without the
`search_all_*` flags the host sends, so the 400 is the API rejecting a partial query, not a
block. KMITL answers requests from Cloudflare, and the proxy must forward the full parameter set
that `teachTableParams` in `src/lib/api/endpoints.ts` builds. The owner ruled the probe done.

The planner was already built around injection. Four product files bind the extension runtime,
`src/entrypoints/background.ts`, `src/entrypoints/regis.content/index.tsx`,
`src/lib/messaging/sendTyped.ts`, and `src/lib/storage/browserAdapter.ts`, and the gateway takes
its network access from `GatewayEnv.fetch`. The shared shell reached registration code in four
places: the toast region imported the helper's toast floor, which pulls in the fill engine; the
plan menu imported the helper store; the search controller and the quiet route imported the
route classifier and quiet mode from `lib/regis`; and the message protocol imported the host
check schemas.

## Decision

### The forwarder

The Worker `kcp-landing` gains `worker/index.ts`, which runs first only for `/api` and `/api/*`.
Every other path is a static asset as before, and a missing file that reaches the Worker is
handed to the assets binding with the site security headers added when absent.

It answers GET only, on six exact paths, matched without decoding, trimming, or prefix rules:

| Path                     | Upstream URL                                                                                  | Edge copy | Upstream timeout |
| :----------------------- | :-------------------------------------------------------------------------------------------- | :-------- | :--------------- |
| `/api/teach-table`       | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show` and the checked parameters | 60 s      | 43 s             |
| `/api/ref/faculty`       | `https://api.reg.kmitl.ac.th/faculty/?function=get-faculty`                                   | 24 h      | 13 s             |
| `/api/ref/department`    | `https://api.reg.kmitl.ac.th/department/?function=get-registrar-department`                   | 24 h      | 13 s             |
| `/api/ref/curriculum`    | `https://api.reg.kmitl.ac.th/curriculum/?function=get-curriculum&LEVEL_ID=1`                  | 24 h      | 13 s             |
| `/api/ref/subject-owner` | the fixed `get-reference` address the extension uses for subject owners                       | 24 h      | 13 s             |
| `/api/ref/current-term`  | `https://regis.reg.kmitl.ac.th/api/?function=get-year-semester-now&level_id=1`                | 24 h      | 13 s             |

Any other method answers 405 and any other path under `/api` answers 404, both as JSON. The
reference addresses are frozen literal strings that no request value ever reaches, which matters
most for `get-reference`, a reader that takes its table from the query; a test compares each one
with a committed literal. A new upstream function or reference table needs its own route, an
amendment to this record, and the owner's ruling.

The teach table parameters pass a strict schema per search mode, derived from the protocol's
`teachTableQuerySchema` and a format for every key, so the two cannot fork: year from 2560 to the
current Buddhist year plus one, semester 1 to 3, faculty and department two digits, curriculum one
to three digits or `x`, class year 0 to 8, subject id eight digits, subject owner one to three
digits, and each flag `true` or `false`. A query over 512 characters, a repeated key, an empty
value, or a key the mode does not take is refused with 400, and so is any query on a reference
path. The upstream address is built with `URLSearchParams` over the checked keys in sorted order,
so every value is percent encoded. The six paths are the Worker's own exact match; Cloudflare's
URL normalization, on by default, runs before the Worker and may turn some encoded or doubled
paths into an allowlisted one, which is harmless because it never yields a path outside the
six. One module holds the only `fetch` call, and it refuses any
address outside a frozen allowlist before calling: the five reference strings, and for the teach
table the regis origin, the path `/api/`, and exactly one `function`, `get-teach-table-show`. The
function names the Worker can send are pinned by a test, and the literal write name scan covers
the Worker source, the built app, and the deploy dry run output.

The outbound request is a new GET with only `Accept: application/json`, no redirect following, no
cache, and the timeout above. No header from the browser is copied, so the code forwards no
cookie, no referrer, no origin, no user agent, and no client address. Cloudflare adds a
`CF-Worker` header naming the `cecs.sh` zone to every such request, and it cannot be removed.
The Cloudflare HTTP request headers reference
(https://developers.cloudflare.com/fundamentals/reference/http-headers/) states that for a
subrequest to a destination not on Cloudflare the Worker script controls `CF-Connecting-IP` and
`x-real-ip`, and that for a subrequest to another Cloudflare zone `CF-Connecting-IP` is set to the
fixed Worker address `2a06:98c0:3600::103`. Where KMITL's servers are hosted is not known, so
either case can apply, and the page does not cover `X-Forwarded-For` on subrequests. A request
through a throwaway Worker to a server the project controls, never a KMITL host, confirms that no
header carrying the visitor address arrives; until it does, the privacy policy says KMITL may
receive the address. The Worker never retries, and it drops every upstream response header.

### What is cached and checked

The teach table body is never decoded in the Worker, because Workers Free allows 10 ms of CPU per
request and the largest capture is 1.7 MB. A declared length over 8 MiB is refused before reading,
and otherwise the body is read as a stream whose length is counted and which is cancelled once it
passes 8 MiB. It is cached only when, after an optional byte order mark and whitespace, its first
byte is `[` and its last byte that is not whitespace is `]`. The content type is not checked,
because no upstream content type has been observed; the dark launch records it here. The
reference bodies, 207 KB at most, are parsed and checked with the shared list schemas under a
1 MiB cap before they are kept for a day. The CPU of that parse is measured before launch; if the
curriculum route exceeds 5 ms at the 99th percentile it moves to the byte check with a one hour
copy, recorded here. The browser then validates every response in full with the same schemas as
the extension, as rule 5 requires; the Worker's check decides only what may be cached.

Copies live in the Cloudflare cache of the data centre that served the request, under keys built
from the checked parameters, never from the request address. The original upstream bytes are
stored and returned, so nothing is rewritten. A failure is remembered for 15 seconds per key. The
served copy carries no age or fill time header, since on a cache shared between visitors either
would tell one visitor that someone else made the same search. The client stamps its data date
when the answer arrives, so the date of ADR-0055 can read up to about one minute later than the
data. No request handler waits on a promise another request created, which the Workers runtime
does not allow; concurrent misses for one key are limited instead, and a miss over that limit
reads the cache at growing intervals until the route's upstream timeout has passed, 43 seconds
for the teach table, before it answers busy. That costs wait time, not CPU. Because the limit is
approximate and local to each location, a burst on one slow search can still start a few
duplicate upstream fetches, up to two per 10 seconds while the first is downloading, and a
follower that waits past the timeout answers busy; this residue is accepted, and no hard bound
is claimed for production.

### Limits and the breaker

Four rate limit bindings, which Cloudflare documents as approximate and local to each location,
run only on a cache miss:

| Counter           | Key                                                                                                          | Limit                                                |
| :---------------- | :----------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| Per client        | a salted SHA-256 of the client address, as its /64 prefix for IPv6 and in full for IPv4, first 16 hex digits | 40 misses per minute                                 |
| Location budget   | one fixed key                                                                                                | 120 misses per minute                                |
| Per search        | the cache key                                                                                                | 2 misses per 10 seconds                              |
| Upstream failures | one fixed key                                                                                                | 10 per minute, then the breaker opens for 60 seconds |

Only an upstream 5xx, a network error, or an upstream timeout feeds the failure counter, and each
search key counts at most once while its 15 second failure entry exists. That entry is written
before the answer is sent, so the client's own retries never count, and the breaker needs
failures on at least three distinct searches. A redirect, an unexpected 4xx, an oversized body,
or a failed byte check is remembered as a failure but does not count, since a client can provoke
those on purpose. A client that can provoke timeouts or 5xx on several searches can still open
the breaker for every visitor at that location for a minute, and one that rotates IPv4 addresses
or holds several IPv6 /64 prefixes can still spend the location budget. Both are accepted abuse
residue, with the kill switch below as the owner's override.

An upstream 429 or 503 opens the breaker at once for its `Retry-After`, held between 60 and 300
seconds. A dashboard variable, `UPSTREAM_MODE`, kept across deploys and never set in the
configuration, lets the owner stop upstream traffic at once: `cache-only` serves copies and
answers busy on a miss, and `off`, or any unknown value, answers busy to every `/api` call. These
numbers are starting values. The project collects no demand data, so they are not measured, and
they change only with a release. The salted hash is used only as a counter key, and the Worker
stores no address. The availability of the rate limit binding on Workers Free is not stated in the
documentation; it is checked before launch, and the launch waits for a separate change if it is
not available.

Every answer that means try later is a 429 with `Retry-After`, with the body `busy` or
`unavailable`: a limit, the breaker, the kill switch, a remembered failure, an upstream 429, and an
upstream timeout. The shared client never retries a 4xx, so a busy answer costs one request, and a
new shared message says the course service is busy or not answering. Only a first upstream failure
answers 502, which the client retries twice; those retries meet the remembered failure. A bad
parameter answers 400 with the field name and the fixed text `invalid`. An upstream field error
passes on with field names from the mode's keys and messages from a short allowlist, so no
response repeats a value the request or the upstream supplied.

Every `/api` response carries one header set written in code: JSON content type, `no-store`,
`nosniff`, a same origin resource policy, no referrer, `default-src 'none'`, HSTS,
`X-Frame-Options: DENY`, and `noindex`. It never carries `Set-Cookie` or any cross origin header,
so another site cannot read a response in a browser.

### Friction for other sites

Every call from the app carries `KCP-Client: web-1`. A page on another origin cannot add such a
header without a preflight the Worker never approves, and an image or script tag cannot add one at
all. The Worker also refuses a request whose `Sec-Fetch-Site` is present and not `same-origin`, or
whose `Origin` is present and not `https://kcp.cecs.sh`. A WAF custom rule refuses header less
requests at the edge before they count as Worker requests. This is friction against pages that
would turn their visitors into a load on the registrar. It is not authentication: any program
outside a browser can send the header, and the service is open on purpose. `robots.txt` disallows
`/api/`.

### The app

A separate Vite build, `vite.web.config.ts`, builds one HTML page, one script file, and one
stylesheet into `site/app` from `src/web`, and the build script writes the English page from the
Thai one with only the language and its meta changed, so both reference the same files; the folder
is not committed and is built by the deploy job. The entry imports the jitless Zod configuration
first, as both extension entries do, so Zod never probes `new Function` under the app's script
policy. In place of the extension runtime it supplies an IndexedDB storage adapter over the same
keys and migrations, an in page send that runs the existing router with the reference, current term,
teach table, and cancel handlers, extracted from the extension worker into one shared function so
neither product restates them, and a `fetch` that maps each upstream address the endpoint table
builds to its `/api` path and refuses any other address without a request. Both web seams copy
values as JSON, as runtime messaging and `storage.local` do in Chrome. The gateway, cache,
normalizer, conflict engine, plans, revalidation, exports, and dictionaries are the extension's
code. The panel renders in an open shadow root through a panel frame it shares with the overlay,
without the launcher, the close control, the focus trap, or the scroll lock, and with the frame's
single `main` landmark. The stylesheet is linked in the document head as well as in the shadow root,
so its `@property` rules register, as WXT arranges for the extension.

The modules the web graph reaches no longer import registration code. The toast floor and the
Prepare for registration action are slots the helper fills when it mounts. The route classifier
and quiet mode move to `lib/routing` and `lib/api`. The host check request leaves the core
protocol for a registration protocol module that the extension worker composes, and the router
and send become generic over the message set, so the core protocol imports nothing from
`lib/regis` or `lib/contract`. The header takes its badge, close action, error text, and Escape
line as data from the entry, so no shared component tests which product it is in. Lint forbids
the shared folders from importing registration code again, with three named exceptions that only
the extension loads: the launcher and the two worker side host check modules of ADR-0079. The
web build fails if any module under `features/regis`, `lib/regis`, `features/diagnostics`,
`lib/contract`, or `lib/api/debug`, any extension entrypoint, or `wxt` reaches it, if its output
holds the debug canary or a write name, or if it emits more than one script chunk or meets a
dynamic import.

The Copy registration list action in the plan menu and the selected courses list ships on the
web. It is a plain text export under `features/plans` and `lib/export`, imports no registration
code, and is not part of the excluded helper. The web and the extension share the dictionaries,
so each carries the other's strings as inert data; this is an accepted exception, kept so the tone
and unused key tests stay whole.

The app pages set their own policy in `_headers` on `/app/` and `/app/en/`: scripts, styles,
fonts, and connections from the site only, images from the site and `data:` URLs, which the PNG
export needs, no referrer, and `noindex` while in Beta. With `connect-src 'self'`, the browser
never contacts a KMITL host from the web version.

A tab left open across a deploy keeps running old code. The web build has no lazy chunks, which the
build guard enforces, so it never asks for a file a deploy removed. The proxy contract only grows by
adding: no route or field is renamed or narrowed, and a breaking change needs a new path prefix and
an amendment. Before each plan write a web tab reads the newest app version and schema version
recorded by any tab, and refuses to write over a newer one, showing one line that asks to reload.

### Beta, the install prompt, and affiliation

On the web the brand pill reads Beta from 640 px, the overflow line reads KCP Beta below it, a
screen reader hears KCP web version, Beta, and the page title, the home screen title, and the
social card title read KCP Beta. Beta is narrower than the version, so the clearance of ADR-0073
holds, and exports stay unchanged. Each landing link to the web version carries a Beta badge, and
a test fails if one does not; the README link and any doc link to the web version read web
version (Beta), checked the same way.

The non affiliation line and the install strip are project decisions, not owner rulings. The
first visit shows one strip, never during the tour or on the export page and never again once
closed. Its English non affiliation sentence is the PRIVACY.md sentence word for word, pinned by a
test so the two cannot fork; the Thai is its translation in the wording of the landing footer,
since PRIVACY.md has no Thai version. The strip also says that plans are saved in this browser and
should be deleted on a shared computer. It asks to install the extension only in a browser that
can install it, Chromium on a computer or Firefox,
and never on iPhone, iPad, Safari, or Chrome on Android. Its dismissal is kept under its own web
key, so the extension's onboarding record does not change. The overflow menu always offers the
landing download section and shows the same non affiliation sentence at every width.

### Deploy

A deploy workflow, called by the release workflow when a version is tagged and dispatchable for a
released tag, builds the landing site and fails if it differs from the committed one, builds the
app, runs the route, egress, header, and write name tests, runs a dry deploy and scans its output,
and deploys with Wrangler. It runs in the GitHub Environment `cloudflare-production`, which requires
the owner's approval and admits only `main` and version tags, with read only repository permissions.
The token there is a custom token for the one account with Workers Scripts Edit and Account Settings
Read, and for the `cecs.sh` zone only, Workers Routes Edit and Zone Read; any other scope is added
only when a deploy names it. Install, build, and tests run in a job without the environment; the
deploy job takes the built output as an artifact and sets the token only on its single Wrangler
deploy step, so no dependency script or test runs while the token is in scope. A rollback to a tag
from before this record deploys that release's static site alone. Workers Builds is disconnected, so
nothing deploys from a push to `main`, and a landing change goes live with the next release. The
Worker configuration turns observability and invocation logs off and sets no log push, no tail
consumer, and no source map upload.

### Privacy

The policy gains a section for the web version. Plans, settings, the last search, and cached
course data are kept in the browser's storage for kcp.cecs.sh. Searches, and the checks that run
when a plan opens, send each entry's source search, such as the term, the faculty, or a subject
id, to kcp.cecs.sh/api, and together those searches show which subjects or groups a plan contains;
the plan file, its name, and the settings are not sent. The forwarder copies no cookie or header,
sets no cookie, has no logging of its own, and keeps copies of course data only, shared between
visitors, for a minute or a day. Cloudflare receives the visitor's address to deliver the site,
requests it blocks at the edge can appear with their address and the requested address, search
included, in the owner's security log, and KMITL may receive the address unless the header test
shows otherwise. The Website section of the policy is rewritten to name that security log, and
the WAF custom rule that writes it is created only after the release carrying that text deploys.
Clearing site data, or a browser's own clean up, can delete plans, so the policy and the strip say
to export a copy and to delete plans on a shared computer. `wrangler tail` is never run against
production. Bot challenges, which set cookies, stay off unless the policy changes first. WAF rate
limiting rules also stay off unless the policy changes first, because a rate limit would record
the address and search of students using the web version, while the custom rule records only
requests that do not come from the app.

### Amendments

Brief section 6.9 lists no server backend as a non goal. For the web version only, a stateless
forwarder for public course data on the project's own domain is allowed. It holds no account and
no user data, and has no logs of its own. The extension still has no backend and never calls it.

Brief section 4.7 places all network egress in the background service worker. For the web version
the same gateway runs in the page, and its only egress is same origin `/api`, enforced by the
Content Security Policy, by the fetch lint ban extended to `src/web`, and by the local refusal in
the fetch adapter. Cache rules, coalescing, retry, timeout, and cancel are unchanged.

Section 10.3: item 2 extends to `src/web` and `worker/`; item 3 becomes all fetches originate in
`lib/api`, behind the extension worker or the web gateway, and in the Worker's egress module; item
4 adds the proxy parameter schema and the IndexedDB reads; item 6 extends to the web; item 7
extends the canary scan to the built app and the Worker dry run output.

ADR-0066: a Worker script now exists for `/api` only, the landing pages stay static assets, the
site deploys from the release workflow, and the web button opens once the web version has run
dark for one release. ADR-0073: the web shows Beta in place of the version. ADR-0075: its route
classifier and quiet mode moved to `src/lib/routing/registrationRoute.ts` and
`src/lib/api/quietMode.ts`; the policy is unchanged, and the web send is not quiet aware because
the web version has no registration pages.

## Alternatives

- **Call the KMITL endpoints from the page.** Rejected: the page's policy would have to admit
  foreign connections, and the browser would contact KMITL directly for every search.
- **Forward any path or function under `/api`.** Rejected because it would make the forwarder a way
  to reach registration write endpoints or any table `get-reference` can read.
- **Validate every teach table payload in the Worker.** Rejected for the 10 ms CPU limit; the
  browser validates in full.
- **Keep search results at the edge for 10 minutes, as the client does.** Rejected for now: the
  client stamps the data date at arrival, so it would read up to 10 minutes late, and reading the
  age instead would change shared code.
- **Serve old copies while the breaker is open.** Rejected for the same data date reason.
- **Share one upstream request between concurrent requests in an isolate.** Rejected: the Workers
  runtime forbids using one request's I/O from another, and a disconnect cancels the first.
- **A WAF rate limiting rule per address.** Rejected because it would record the address and
  search of every limited request from students using the web version in the owner's security
  log.
- **Plans in localStorage.** Rejected: a search response would exhaust its quota, and lint bans it
  in all of `src`.
- **Build the app in Workers Builds from `main`, or commit the built app and Worker.** Rejected:
  the first deploys unreleased code; the second keeps large built files in history and still lets
  the Worker drift from the app.
- **A flavor flag in shared components.** Rejected for data the entry injects, which leaves no
  branch that one build can never run.
- **Allow the pure registration leaf modules in the web bundle.** Rejected because the ruling
  excludes everything under `lib/regis`, and a guard with no exceptions is easier to audit.
- **A cap on how many searches one plan check replays.** Rejected: the per client limit already
  bounds a crafted plan, and the groups past it keep their status through the existing partial
  outcome.

## Consequences

- Students without the extension can search, plan, check, and export, with Beta on every way in.
  The extension keeps its permissions, `["storage"]` and the two KMITL origins, and its behaviour:
  each refactor ships with green unit and end to end suites, the registration suites included,
  a byte identical manifest, and a stylesheet diff limited to utilities the change lists, with
  the pure move changes keeping the stylesheet byte identical. The built script differs, since
  the refactors change component and router code.
- The registrar sees requests from Cloudflare naming the `cecs.sh` zone: about one per search per
  data centre per minute, one per reference list per day, and none while the breaker or the kill
  switch is on. That is observation, not notice.
- Search results can be up to about a minute older than their data date. A busy answer shows one
  sentence with a retry action. Students behind one campus address share the per client limit and
  can see busy at peak, and a burst on one slow search can answer busy to followers that wait past
  its timeout.
- A scripted client that sends the header can spend the 100,000 daily Worker requests, after which
  `/api` fails until the next day. Adding a rate limiting rule then is an incident step that
  needs a policy change first.
- Plans kept only in the browser can be lost when site data is cleared or evicted, which the
  policy and the strip say.
- A landing change goes live with a release rather than on merge.
- Copy image writes the clipboard inside the press on every target, which WebKit requires.

## Tests

Unit tests cover the upstream address pins and literals, the derived parameter schema over every
query the search forms build and every source query in the plan and migration fixtures, the
smuggling vectors (`%26function%3Dget-reference`, `%23`, `+`, `%00`, a repeated key, a client
supplied `function`; the smuggled name is a read function so no test holds a write name), the fetch
adapter's mapping and local refusal, one request for a busy answer and three for a first failure,
the busy message, the shared core handlers, the IndexedDB adapter against the shared adapter
contract, the write fence, the install target table, the header data for both products, the panel
frame, the notices, the disclaimer pin against PRIVACY.md, the jitless import in every entry, and
the build guard. Worker tests cover every route, path vector as the Worker's own matching, method,
status row, header, limit, address normalization, and which failures feed the breaker with stubs,
plus reference specific invalid bodies and the streaming size cap, and run again in workerd with
outbound requests mocked for the cache, `waitUntil`, a miss over the per search limit, and aborts;
the workerd results describe the local binding, not a production bound. A `wrangler dev` smoke reads
the served headers on the app pages, an asset, a missing asset, a missing page, `/api`, and `/api/`.
The web end to end suite runs in Chromium and WebKit under the served headers, answers `/api` from
the capture fixtures, fails on any request to another origin or any CSP violation, and covers the
search tabs, placement, several plans, a plan check, every export template, copy image, copy as
text, the Beta labels, the notices, axe, and a text fit sweep at 360, 390, 768, and 1366 px in both
languages. Touch drag is not automated in WebKit, whose Playwright driver has no raw touch input; it
is checked by hand on an iPhone during the dark launch.

## Before launch

Three checks are recorded here as amendments when done: whether the rate limit binding works on
Workers Free and the CPU of the reference check, measured on a throwaway Worker with the committed
captures; which headers reach a server the project controls through a newly built request; and a
dark launch, one release with the forwarder and the app deployed while the landing button still
reads Coming soon, in which the owner runs one search per tab and one plan check by address,
records the content type the upstream returns, and places one section by touch on an iPhone.

## Revisit triggers

KMITL changes an endpoint or its parameters, the daily request limit or the busy rate is reached
in practice, the header test shows a client address reaches KMITL, Cloudflare changes what Workers
Free includes, or the owner asks for a feature that needs registration code, diagnostics, or a new
upstream function.
