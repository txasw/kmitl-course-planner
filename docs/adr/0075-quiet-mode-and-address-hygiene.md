# 75. Quiet mode and address hygiene on the registration pages

Status: Accepted
Date: 2026-11-23

Amends brief section 4.7 on cache, retry, and request policy and section 6.6 on revalidation on
open. Reviewed against rule 5, zero trust of external data, and rule 6, read only integration with
the host site.

## Context

The content script mounts on every route of the host, including the pages where students register:
`#/pre_registration`, `#/registration`, and the officer and special variants
`#/registration_for_officer`, `#/registration_x`, `#/registration_queue`, and
`#/registration_future_innovation`. When pre registration opened on 2026-11-23 the registrar was
overloaded: the public `get-teach-table-show` endpoint did not answer within the 45 second timeout,
and a direct request to it failed. KCP added to that load. Opening the panel checked the active
plan against live data, the search form fetched the four reference lists and the current term, and
each failed request was retried twice with backoff. None of that helps a student who is registering
at that moment; the plan they need is already stored.

A study of the host bundle also showed that its address can carry what KCP must never hold. A sign
in lands on `#/google_oauth_handling?token=...`, some officer and report routes take `student_id` or
`std_id` in the query, and a sign in redirect can append its fields to the hash. KCP read the raw
hash in its route listener and kept the last value between signals, the entry toast kept the hash
from mount, and each back to close layer (ADR-0067) kept the full page address to compare before it
went back. None of these values left memory, but a later change could pass one to a store, a log, or
the DOM without anyone noticing.

## Decision

**Quiet mode.** A pure classifier in `lib/regis/route.ts` names the six registration routes by path,
ignoring the query, letter case, and a trailing slash, as the host router does. While one of them is
on screen KCP starts no request by itself:

- Opening the panel and switching plans run no plan check. The plan renders from its snapshots with
  its last verification status, and the student can still check by hand.
- The reference lists and the current term load from the worker cache alone. A cache read never
  fetches and answers a miss with a network error, which leaves the form on its local fallback term
  and shows the reference banner with its retry.
- No search runs or restores by itself. KCP has no version or update check, and the mount handshake
  and the welcome claim reach only the worker.

A request the student asks for, a search, a refresh, a check, or the reference retry, still runs,
but every request started on these pages asks for no retry, so a failure is final after one attempt.
The content side wraps the injected send once, so no call site can forget it, and the worker honours
the two new request options, `noRetry` and `cacheOnly`, in the gateway. The page is read when each
request starts, so leaving it restores normal behaviour for the next request, and a reference list
that failed loads again when the form next mounts. A one line notice at the head of the catalog
column says that the registration system may be busy, so KCP sends a request only when the student
searches or checks.

**Address hygiene.** One shell module, `features/shell/hostLocation.ts`, is the only reader of the
address. It returns the hash sanitized to the route path, plus the teach table search fields on the
`#/teach_table` result route, whose names come from the query schema so the list cannot drift from
what the search sends. A path is the leading run of route name characters, so a query or appended
sign in fields are never part of it. Every route consumer reads through it. Where a back to close
layer must tell whether the address moved, it keeps an opaque marker instead: a 53 bit digest of the
full address under a seed drawn once per document, which compares equal for equal addresses and
says nothing about the address itself.

Two lint rules hold the source to this. `sessionStorage` and `localStorage` are forbidden in every
file under `src`, since KCP keeps its state in the extension storage and the page web storage holds
the host session. Reaching the location object through `window`, `document`, `globalThis`, or any
other object, by name or by a computed key, is forbidden outside the shell reader and the tests, and
so are `document.URL`, `documentURI`, `baseURI`, the navigation `currentEntry`, and the hash change
`newURL` and `oldURL`, which expose the same address. A bare `location` global is forbidden in every
file, since the reader and the tests reach the address through `window`. A test reads the rule
settings from the repository config and fires them on sample sources, so dropping either guard fails
the suite.

The reader keeps a teach table search field only when its value has the shape a search sends, a mode
name, a digit code, a string flag, or the `x` sentinel, so a credential that a redirect folds into a
field value, after a second query mark or as an encoded query, is dropped with that field.

## Alternatives

- Hide the search on the registration pages. Rejected because a student may need the sections of
  one subject during the window, and one request on a press is the same load the host page causes.
- A toast for each request started on these pages. Rejected because one toast shows at a time, so it
  would hide the outcome toasts the refresh already uses.
- Skip the reference reads entirely rather than read the cache. Rejected because the class and
  category tabs would show options as loading with no way forward, while a cache read costs the
  registrar nothing.
- Parse the full hash and discard unwanted fields where they are used. Rejected because the raw
  value would still be held between signals.
- Read the marker KCP already pushes from `history.state`. Rejected for the reason ADR-0067 records:
  Chromium serves a content script a stale value once the page reads it.
- Classify by a `registration` name prefix. Rejected because it would also catch unrelated officer
  pages such as `#/registration_batch_jobs`.

## Consequences

On the registration pages KCP sends nothing on its own, and what the student asks for costs one
attempt per request. A plan may show an older verification there; it is checked again on the next
open of another page. The end to end suite proves both halves: a plan due for a check, under an
empty worker cache, opens on `#/pre_registration` with no request at all and still runs one request
on a search the student presses, and the same setup on `#/teach_table_selector` checks the plan and
loads the reference lists on open.

The address KCP holds is now only a route path and public search fields. A future feature that needs
more of the address, or a new registration route, changes the reader or the classifier and its
tests, not a consumer. Permissions are unchanged, `["storage"]` and the two host origins.

## Amendment, 2026-11-26: the host check request

ADR-0079 adds one request KCP starts by itself on the pre registration page: when the page loaded
an app script KCP has not checked before beside a tested vendor script, the worker downloads that
public script file once to fingerprint it. It carries no cookie, no referrer, and nothing of the
student, and it goes to the host's static file server, not its registration API. A result is kept
by the script's name, so the file is read once per new build per browser; a request that did not
complete is tried again only on a visit an hour later. This is an exception to "While one of them is
on screen KCP starts no request by itself" above. Whether the check may run on arrival, as built,
or only on the student's press is an open question for the owner, recorded here so the two
decisions do not disagree in silence.
