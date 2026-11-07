# Test fixtures

## Provenance

Every JSON fixture with a `.capture.json` suffix is a real response captured
verbatim from the live registration API. The original captures date from
2026-07-07; the multi meeting and with exams captures were added on 2026-07-12 and
the current term capture on 2026-11-05. These are the fixtures the domain layer is
tested against. They contain only public course data.

| Fixture | Endpoint | Source URL |
| :-- | :-- | :-- |
| `faculty.capture.json` | GET faculty list | `https://api.reg.kmitl.ac.th/faculty/?function=get-faculty` |
| `department.capture.json` | GET department list | `https://api.reg.kmitl.ac.th/department/?function=get-registrar-department` |
| `curriculum.level1.capture.json` | GET curriculum list, level 1 | `https://api.reg.kmitl.ac.th/curriculum/?function=get-curriculum&LEVEL_ID=1` |
| `subject-owner.capture.json` | GET subject owner groups | `https://api.reg.kmitl.ac.th/reference/?function=get-reference&table=TEACH_TABLE_SUBJECT_OWNER&...` |
| `teach-table.by_class.capture.json` | GET teach table, mode by_class | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_class&selected_year=2569&selected_semester=1&selected_faculty=01&selected_department=05&selected_curriculum=137&selected_class_year=1` |
| `teach-table.by_subject_id.capture.json` | GET teach table, mode by_subject_id | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_subject_id&selected_year=2569&selected_semester=1&selected_subject_id=90641007` |
| `teach-table.by_subject_owner_id-32.capture.json` | GET teach table, mode by_subject_owner_id | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_subject_owner_id&selected_year=2569&selected_semester=1&selected_faculty=01&selected_subject_owner_id=32` |
| `teach-table.multi-meeting.capture.json` | GET teach table, mode by_class, all curricula | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_class&selected_year=2569&selected_semester=1&selected_faculty=01&selected_department=05&selected_curriculum=x&selected_class_year=0&search_all_curriculum=true&search_all_class_year=true` |
| `teach-table.with-exams.capture.json` | GET teach table, mode by_class, faculty 01 department 05, several curricula and class years | Query string not recorded with the capture |
| `year-semester-now.capture.json` | GET current registration term, level 1 | `https://regis.reg.kmitl.ac.th/api/?function=get-year-semester-now&level_id=1` |

## What each teach table capture exercises

`teach-table.by_subject_owner_id-32.capture.json` is the richest single fixture. Its
13 raw section rows collapse to 4 unique sections after deduplication by
`teach_table_id`. It carries the documented duplicated ids (`135224`, `135340`), the
lecture and practice pair for subject `90592033` (`135273` linked to `135274` through
`sec_pair`), the `count` union with a numeric value (`135224`) and the string
`เต็ม/Full` (`135273`, `135274`), the literal `x` grouping sentinel with null name
fields, and multi teacher rows.

`teach-table.by_class.capture.json` holds 35 unique sections with no duplication. It
covers the day mapping (its `teach_day` values span 1 through 6), the `limit` value
`-`, a null room field, and present midterm and final exam datetimes.

`teach-table.by_subject_id.capture.json` is a single subject query (`90641007`) whose
499 raw rows collapse to 44 unique sections, exercising deduplication at scale.

`teach-table.multi-meeting.capture.json` was captured later, on 2026-07-12, from the all
curricula path. It is the fixture for multi meeting sections: a section's extra class
periods are packed into `teachtime_str` as `<day>x<H:MM>-<H:MM>` segments, not separate
rows. It carries subject `01476101` section `34` with a second Thursday period
(`teachtime_str` `5x10:30-12:00` after the primary `08:45` to `10:15`) and subject
`01076311` section `1` with two extra periods on one day, so it exercises the parser, the
day that differs from `teach_day`, and a section that totals three meetings. See ADR-0037.

`teach-table.with-exams.capture.json` was added on 2026-07-12. It is a broad `by_class`
result for faculty 01 department 05 that spans several curricula and class years, and the
broadest capture: 24 curriculum groupings whose 331 raw rows collapse to 255 unique
sections across 154 subjects. Its `teach_day` values span the full `0` through `7` range,
including unscheduled rows and both weekend days, meetings run as late as 20:00, and it is
the capture that populates the exam fields, with 78 rows carrying a midterm window and 107
a final window. It drives the exam datetime parser, the contract auditor, the normalizer,
the exam schedule, the seat demand, the credit split, and the sanitize tests, a few
catalog component tests, and the measurements in ADR-0054. The mock server serves it for
the reserved subject id `90000700`, so the grid window spec can load a result that widens
the edit grid.

## Current term capture

`year-semester-now.capture.json` was captured later, on 2026-11-05, and is kept as the
single line body the server sent. It reports the term the registrar considers current,
`YEAR` `2569` and `SEMESTER` `1`, with three datetime fields the extension does not read.
The search form defaults to the term after it. See ADR-0053.

## Host DOM snapshots

`host-dom/` holds rendered HTML snapshots of the registration site used to confirm the
content script assumptions and to verify the day of week mapping. The result snapshot
renders each section under a Thai day name, which cross checks the numeric `teach_day`
values in the captures. The site JavaScript and CSS bundles are intentionally excluded;
only the public markup is kept.

## Synthetic fixtures

The synthetic fixtures are hand built teach table responses in the exact captured shape,
for cases the real captures do not provide. Each carries only synthetic course data and is
served by the mock server for a reserved subject id, so no other spec sees it.
`regressions/teach-table.fit-regression.json` is synthetic too; see the regressions
README.

`synthetic.block-interactions.json` serves the end to end block interaction specs for the
reserved subject id `90000000`. They need overlapping open sections and a multi section
subject, which the real captures do not provide (their multi section subject is full and
their open sections do not overlap). Its `synthetic.block-interactions.fresh.json` variant is what the mock serves after a spec
asks for fresh data: Course A (`900001`) moves to a new day and time and Course E (`900005`)
is dropped, so a revalidation sees one changed and one missing entry.

`synthetic.exam-overlap.json` serves the exam overlap spec for the reserved subject id
`90000010`. It holds two subjects on different days, so neither blocks the other by time:
`90000010` section `901` on Monday and `90000011` section `901` on Wednesday, whose
midterm windows overlap on 2026-08-21. A second section of `90000011`, `902` on Thursday,
has its midterm on the next day, so the blocked add offers it as a clean alternative.

The performance profiling spec needs a catalog at the acceptance scale, hundreds of
sections, which no real capture reaches: the largest, `teach-table.by_subject_id.capture.json`,
dedupes to 44 unique sections. Rather than commit a large synthetic file, the dense
catalog is generated at run time by `tests/e2e/support/denseCatalog.ts`, which clones one
real row shape from that capture and multiplies it into hundreds of unique open sections.
The mock serves it for the reserved subject id `90000500`, and serves the real 499 row
capture for `90000499`, so the profiling run measures both the normalize path on the real
payload and the render and drag at scale. The generator header records the full provenance.

## Regressions

`regressions/` holds payloads captured from live contract deviations. See its README
for the capture workflow.
