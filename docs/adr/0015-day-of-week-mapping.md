# 15. Day of week digit mapping

Status: Accepted
Date: 2026-07-07

## Context

The teach table API sends the meeting day as `teach_day`, a 1 based digit string.
The domain model uses a 0 based `DayOfWeek` where 0 is Sunday. The original
working assumption was that 1 is Sunday through 7 is Saturday, so 6 is Friday, but
that assumption needed empirical confirmation before it was encoded as the single
mapping every meeting time depends on. The captured API responses carry the digit,
and the captured result page HTML renders the day as a Thai name, so the two can be
cross checked on shared section identity.

## Decision

Encode the mapping as 1 to Sunday, 2 to Monday, through 7 to Saturday, in one
`DAY_MAP` constant in `src/lib/parsing/days.ts`. The mapping is confirmed by a
fixture based test rather than assumed. In the by_class capture the sections
90642033/905, 90642129/902, and 90643016/904 each carry `teach_day` "6" at start
time 13:00, and the owner-46 result snapshot renders those exact sections under the
Thai day name for Friday at 13:00 to 16:00. The triple match on subject, section,
and start time pins "6" to Friday, and the sequential scheme fixes the rest.

## Alternatives considered

Trusting the brief's working assumption without a test would leave the most
load bearing constant in the domain unverified. A dedicated live probe was
unnecessary because the committed captures and the result snapshot already contain
the evidence.

## Consequences

The observation matches the working assumption, so no constant changed. The mapping
now has a regression test that fails if a future capture contradicts it. The digit 7
(Saturday) does not appear in the current captures; it is covered by the sequential
mapping and its unit test, and would be caught by the auditor if live data ever
carried an out of range value.

## Amendment, 2026-07-08: the unscheduled day 0

Live exports of the all curricula and all class year query, which returns a
broader result than the narrower queries the fixtures were captured from, showed
rows with `teach_day` "0" alongside `teach_time` and `teach_time2` of `00:00:00`.
This is the API's representation of a course with no scheduled meeting, such as an
online or asynchronous course, not an out of range value. The mapping stays 1 to
7; `days.ts` adds an `UNSCHEDULED_DAY` constant and an `isUnscheduledDay` guard, so
`DAY_MAP` keeps only the real days. The normalizer treats an unscheduled row as a
no meeting section rather than a warning, and the contract auditor accepts `0` for
`teach_day` and skips the end after start rule for it, so an unscheduled course no
longer reads as a data error. Section 4.1 and the expectation table are updated to
record `0` as the documented unscheduled sentinel.
