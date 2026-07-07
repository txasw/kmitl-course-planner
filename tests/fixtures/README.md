# Test fixtures

## Reference and teach table samples

`faculty.sample.json`, `department.sample.json`, `curriculum.sample.json`, and
`subject-owner.sample.json` are seed samples that mirror the documented shape of
each reference endpoint, including the known quirks: null names, a department id
of `x`, curriculum ids of varying width, and an inactive curriculum.

`teach-table.shape.json` is a seed sample of the teach table response. It carries
the quirks the domain layer must handle: the same `teach_table_id` (135224 and
135340) repeated across two curriculum groupings so deduplication collapses six
raw rows into four unique sections, a lecture and practice pair (135273 and
135274) linked through `sec_pair`, a `count` value that is a number in one row
and the string `เต็ม/Full` in another, HTML wrapped teacher names, and nullable
name fields.

These samples are labeled as shapes because they are constructed from the
documented contract rather than captured live. Full real responses are captured
through the diagnostics copy as fixture flow when the domain layer is exercised
against the live site, and they replace or extend these samples.

## Host DOM snapshots

`host-dom/` holds rendered HTML snapshots of the registration site used to
confirm the content script assumptions. The site JavaScript and CSS bundles are
intentionally excluded; only the public markup is kept.

## Regressions

`regressions/` holds payloads captured from live contract deviations. See its
README for the capture workflow.
