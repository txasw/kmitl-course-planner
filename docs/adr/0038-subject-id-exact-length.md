# 38. Subject id search requires exactly eight digits

Status: Accepted
Date: 2026-07-13

## Context

The by subject id search tab sends the entered id to the registration server as
`selected_subject_id`. Section 6.2 of the project brief described the field as one
to eight digits, and the client validated it that way: a value of one to eight
digits passed the gate and was sent.

The live server rejects any subject id whose length is not eight. Captured on
2026-07-13, a `by_subject_id` request with a short id returns
`{ "message": { "selected_subject_id": ["length is not equal 8"] }, "code": 400,
"status": "Bad Request" }`. So the client faithfully implemented a brief that was
itself wrong: a one to seven digit search always failed at the server with a
generic error after a wasted round trip, and the student saw no useful reason.

## Decision

Validate a subject id as exactly eight digits. `isValidSubjectId` requires
`/^\d{8}$/`, which tightens the single gate that both disables the submit button
and makes the submit action bail, so a short value never reaches the network. The
existing digits only sanitization and the eight digit paste clamp are unchanged.

Because a hard gate with no feedback is a dead control, the field gains a live
eight digit counter, and a submit or Enter on a shorter value shows an inline
message and focuses the field rather than sitting disabled. The submit button
stays enabled while the id is incomplete so both the click and Enter reach that
message; the other tabs still disable until their form is ready.

As defense in depth for a value that reaches the wire past the field, such as a
persisted or imported search, the fetch layer parses a 4xx field error body onto
the http error and the error mapper turns a 400 that names `selected_subject_id`
into a localized message rather than the generic server error. The live 400 body
is committed as a regression fixture.

Section 6.2 of the brief is amended from one to eight digits to exactly eight.

## Alternatives considered

Keeping the one to eight digit gate and letting the server reject a short id was
rejected because it spends a round trip on a request that can never succeed and
surfaces a generic error instead of a precise one. Segmented per digit input boxes
were rejected because students paste course codes from curriculum documents, so a
single paste first field is the right ergonomics; this is the standing ruling that
the subject id is one field, never segmented boxes.

## Consequences

The by subject id search never issues a request the server refuses for length, the
counter and inline message guide the student to a complete id, and the safety net
mapper localizes the rare case where a short id reaches the wire anyway. The client
contract and the server contract now agree, and the origin of the earlier mismatch
is recorded so a future reader trusts the live observation over the brief.
