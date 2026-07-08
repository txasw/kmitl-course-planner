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
from report 1). Drives the failing normalization test and the all curricula e2e
spec: the schema now accepts the null and the unscheduled row becomes a warning
rather than failing the whole result.
