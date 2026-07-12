# Regression fixtures

When the live site returns data that deviates from the documented contract, or a
request the app builds is rejected, capture the evidence here, write a failing
test that reproduces it, fix the schema or the normalizer, then update the
contract documentation and the expectation table.

## Captures

### teach-table.class-year-empty.error.json

The API's rejection body when a `by_class` request sends an empty
`selected_class_year`. The all class year option must send `0`, not an empty
value. Drives the mock's rejection and the search-all specs.

### teach-table.subject-id-length.error.json

The live 400 body the API returns for a `by_subject_id` request whose
`selected_subject_id` is not eight digits, captured on 2026-07-13:
`{ "message": { "selected_subject_id": ["length is not equal 8"] }, "code": 400,
"status": "Bad Request" }`. The client contract in Section 6.2 originally said one
to eight digits, but the server requires exactly eight, so a shorter search always
failed. The client gate now blocks a short id, and this body drives the safety net
mapper test: the fetch layer parses the field error into `HttpError.fields` and the
error mapper turns a 400 naming `selected_subject_id` into a localized message.

### teach-table.all-curricula-null-teachtime-str.report-1.json, report-2.json

Data quality reports exported from the diagnostics drawer against the live site
on 2026-07-08. Both are `by_class` requests with `search_all_curriculum=true`
(`selected_curriculum=x`) and `search_all_class_year=true`
(`selected_class_year=0`) for faculty 01, departments 01 and 02. The requests
succeeded and returned 201 and 232 rows, but the audit flagged unscheduled rows
carrying `teachtime_str: null`, `teach_day: "0"`, and `teach_time2: "00:00:00"`.
Only the null `teachtime_str` broke the hard schema gate, since it was typed
non-nullable; the day and time values are handled as per row normalization
warnings. The all option queries surface these unscheduled online courses that
narrower queries did not, which is why earlier verification against clean
fixtures missed it.

### teach-table.by_class-null-teachtime-str.capture.json

A raw payload reconstructed from the two reports above, with one scheduled row
and one unscheduled row (`teachtime_str: null`, `teach_day: "0"`,
`teach_time2: "00:00:00"`, matching `teach_table_id` 136407 / subject 01006029
from report 1). Drives the normalization test and the all curricula e2e spec: the
schema accepts the null, and the unscheduled row is a no meeting section rather
than failing the whole result.

Rebuilt when `teachtime_str` became a parsed field (ADR-0037). The scheduled row
originally carried a hand written display string `"จ. 09:00-12:00"` that no real
capture produces; once the field was parsed and audited against its machine
grammar, that value read as drift and misrepresented the real API shape. It now
carries a genuine machine grammar value, `"2x13:00-14:30"`, a second meeting on
its own day, so the fixture keeps an honest shape while still exercising the null
unscheduled regression. The rejected display variant is kept as a parser unit test
in `teachTimeStr.test.ts`, not as a fixture.

### teach-table.unscheduled-row.report-1.json, report-2.json

Reports exported after the null `teachtime_str` fix, for the same all curricula
queries (departments 02 and 01). The null is no longer flagged, but the audit
still marked the same unscheduled rows as errors: `teach_day: "0"` fell outside
the 1 through 7 range and `teach_time2: "00:00:00"` failed the end after start
rule. Those are the API's representation of an unscheduled online course, not a
data error, so the contract now recognizes `teach_day: "0"` as the unscheduled
sentinel: the auditor accepts it and skips the time rule for it, and the
normalizer produces a no meeting section without a warning.
