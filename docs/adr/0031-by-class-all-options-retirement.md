# 31. Retire the by_class all faculty and all department options

Status: Accepted
Date: 2026-07-10

## Context

The teach table API carries a `search_all_faculty` and a `search_all_department`
string boolean on every query. On the search by subject id tab the host sets both to
true, because that tab searches across every faculty and department, and on the search
by category tab the host sets `search_all_faculty` to true for an all faculties
category search. Phase 8 item 9 asked whether the search by curriculum and class year
tab, the by_class mode, should also grow an all faculties and an all departments
option, so a student could widen that search the way the other tabs widen.

The host was checked before building anything. The by_class tab on the live site offers
a faculty select and a department select with concrete values only; it has no all
faculties or all departments choice, and the captured host traffic for by_class never
sends `search_all_faculty` or `search_all_department` as true. The project mirrors the
host traffic rather than inventing parameters the server was never observed to accept,
so an all option here would be a guess at an unverified server behavior.

The current code already reflects this. The by_class query builder in
`src/lib/search/formState.ts` sets `search_all_faculty` and `search_all_department` to a
constant false, and the by_class form in `src/features/search/fields.tsx` renders the
faculty select without the all option the category tab passes and renders the department
select from concrete departments with no all sentinel prepended. So there is no dormant
control to remove: the widening was never wired into the by_class UI, only into the two
tabs where the host uses it.

## Decision

The by_class all faculties and all departments option is retired, not built. The flags
stay present in the query and message types, because the by subject id and by category
tabs set them, and they stay wired to a constant false in the by_class path. No by_class
UI control is added, and none is removed because none exists.

## Alternatives considered

Building the option was rejected because it would send the server a parameter
combination never observed in host traffic, against the read only, host mirroring
principle, and a broad by_class query without a verified server contract would as likely
return a validation error as a useful result. Removing the flags from the by_class query
shape was rejected because the shape is shared across all three modes through one typed
builder and one message contract, and the by_class path setting them false is the honest
encoding of what the host sends, not dead configuration.

## Consequences

The by_class search stays exactly as the host offers it, a faculty and a department
chosen from concrete values, and the two tabs that do widen keep their behavior. If the
live site later adds an all faculties or all departments control to by_class and the
server is observed to accept it, this record is superseded by one that adds the control
against that captured traffic, with a fixture to prove the server response.
