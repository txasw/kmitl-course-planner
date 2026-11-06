# 53. Registration term default

Status: Accepted
Date: 2026-11-06

Amends brief section 4.6 (no year or semester endpoint was captured, so the term options are
generated locally, with an official endpoint to be swapped in behind the same interface if one is
found).

## Context

With no persisted search and no `#/teach_table` route, the search form opened on the newest
generated Buddhist year and semester 1. The generator runs to the current Buddhist year plus one,
so in November 2026 the form opened on 1/2570, a term about a year away. Students use the planner
for the registration ahead of them, so that default was wrong for almost everyone on a first run.

The registrar exposes the current term at
`https://regis.reg.kmitl.ac.th/api/?function=get-year-semester-now&level_id=1`. A capture taken on
2026-11-05 returned `{"YEAR":"2569","SEMESTER":"1"}` with three datetime fields:
`START_DATETIME_SYSTEM`, `START_DATETIME_ACADEMIC` and `END_DATETIME_ACADEMIC`. It is a single
object, not an array, and it lives on the regis host beside `get-teach-table-show`, not on the
reference host.

## Decision

Next term as the default. The form defaults to the term after the reported one: semester 1
becomes 2 of the same year, 2 becomes 3 of the same year, and 3 becomes 1 of the next year. Today
that is 2/2569. `nextTerm` in `lib/routing/academicTerms.ts` holds the rule.

Reference route. The endpoint is served as `ref/currentTerm`, on the same gateway path as the
faculty list: validated, coalesced, and cached in memory and storage for the 24 hour reference ttl.
The schema requires a four digit `YEAR` and narrows `SEMESTER` through `parseSemester`, so a value
outside 1 to 3 fails validation instead of reaching the form. The datetime fields are accepted as
optional nullable strings and are not read. The existing host permission for
`https://regis.reg.kmitl.ac.th/*` covers the request, so the manifest is unchanged. The debug
contract auditor carries matching expectations for the two fields.

One precedence order. `resolveInitialTerm` resolves the opening term from, in order, a result
route with a valid year and semester, the persisted last search, the active plan, the term after
the reported current term, and finally the local fallback of the newest generated year and
semester 1. It stays pure: the caller passes the fetched term in, and the function returns the
source with the term so the caller knows whether a later answer may still replace it. The result
route now takes precedence over the persisted search, which it did not before, because a student
who arrives from a result page is looking at that term. A route with only one of the two fields
no longer supplies half a term; it is skipped.

Never block the form. The current term needs a request, so the form renders the fallback first
and the fetched default applies only while the fallback is still pending. The search store keeps
one `defaultTermPending` flag that the fallback seed sets and any other term write clears: a year
or semester edit in any tab, a plan switch that seeds its term, or a hydrated search. The request
is sent only when no higher source supplied a term, and a failed request keeps the fallback. When
the answer arrives the active plan is read again, because plans hydrate on their own and may have
loaded in the meantime.

The year options are still generated locally. The endpoint reports one term, not the list of
terms the host offers, so the generator stays as the option source.

## Alternatives considered

Defaulting to the reported term itself was rejected, because during a semester the registrar
reports the term in progress while students plan the next one. Deriving the term from the calendar
was rejected because term boundaries move from year to year and the registrar already publishes
the answer; the datetime fields could refine the rule near a boundary, but nothing in the capture
shows how they shift, so they stay unread until a capture does.

Blocking the form until the endpoint answers was rejected, because a slow or failed request would
then delay or break a form that works without it. Comparing the forms against the fallback value to
detect an edit was rejected in favour of the flag, because a student who picks the value already
shown has still chosen it, and a later answer must not override that choice.

Normalizing to a `Term` in the worker was rejected to keep the route identical to the other
reference routes, which return validated raw data; the content side maps it with `toCurrentTerm`.

## Consequences

A first run opens on the term students are registering for, with no change to returning users,
whose persisted search still wins unless they arrive from a result page. The form can show the
fallback for the moment before the answer arrives and then change, but only while nothing else has
written the term. The extension now depends on one more registrar endpoint; if it drifts or fails,
the form keeps the old default and the debug report shows the drift. The end to end mock server
serves the capture so every spec opens on the same term. Swapping in a future endpoint that lists
the offered terms remains open behind the same `resolveInitialTerm` inputs.

## Amendment: one term shared by every tab (2026-11-06)

Each search tab stored its own year and semester, and a tab switch did not carry them over, so
a term picked on one tab was silently replaced by another tab's term on the next search, and a
new plan took whichever term the active tab held. The term is now one value in the search store
that all three tabs search under. It renders once, as a year and semester row above the tabs,
and the tab forms hold only their own fields. A year or semester edit in that row is the student
edit that clears `defaultTermPending`; the precedence order above is unchanged and writes the
one shared term. The create plan form defaults to the same term.

The persisted last search moves to schema version 2 with a single `term` field. A version 1
blob still loads: its active tab's term becomes the shared term, since that is the term the
saved search ran under, and the per tab copies are dropped. Keeping three copies in sync on
every write was rejected because it leaves three sources of truth that a later write can split
again, and taking the newest of the three terms was rejected because it can name a term the
student never searched.
