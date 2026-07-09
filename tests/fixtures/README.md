# Test fixtures

## Provenance

Every JSON fixture with a `.capture.json` suffix is a real response captured
verbatim from the live registration API on 2026-07-07. These are the fixtures the
project brief intends the domain layer to be tested against. They contain only
public course data.

| Fixture | Endpoint | Source URL |
| :-- | :-- | :-- |
| `faculty.capture.json` | GET faculty list | `https://api.reg.kmitl.ac.th/faculty/?function=get-faculty` |
| `department.capture.json` | GET department list | `https://api.reg.kmitl.ac.th/department/?function=get-registrar-department` |
| `curriculum.level1.capture.json` | GET curriculum list, level 1 | `https://api.reg.kmitl.ac.th/curriculum/?function=get-curriculum&LEVEL_ID=1` |
| `subject-owner.capture.json` | GET subject owner groups | `https://api.reg.kmitl.ac.th/reference/?function=get-reference&table=TEACH_TABLE_SUBJECT_OWNER&...` |
| `teach-table.by_class.capture.json` | GET teach table, mode by_class | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_class&selected_year=2569&selected_semester=1&selected_faculty=01&selected_department=05&selected_curriculum=137&selected_class_year=1` |
| `teach-table.by_subject_id.capture.json` | GET teach table, mode by_subject_id | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_subject_id&selected_year=2569&selected_semester=1&selected_subject_id=90641007` |
| `teach-table.by_subject_owner_id-32.capture.json` | GET teach table, mode by_subject_owner_id | `https://regis.reg.kmitl.ac.th/api/?function=get-teach-table-show&mode=by_subject_owner_id&selected_year=2569&selected_semester=1&selected_faculty=01&selected_subject_owner_id=32` |

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

## Host DOM snapshots

`host-dom/` holds rendered HTML snapshots of the registration site used to confirm the
content script assumptions and to verify the day of week mapping. The result snapshot
renders each section under a Thai day name, which cross checks the numeric `teach_day`
values in the captures. The site JavaScript and CSS bundles are intentionally excluded;
only the public markup is kept.

## Synthetic fixtures

`synthetic.block-interactions.json` is the one fixture that is not a live capture. It
is a hand built teach table response, in the exact captured shape, that the end to end
block interaction specs need: overlapping open sections and a multi section subject
that the real captures do not provide (their multi section subject is full and their
open sections do not overlap). The mock server serves it only for the reserved subject
id `90000000`, so no other spec sees it. It carries only synthetic course data.

## Regressions

`regressions/` holds payloads captured from live contract deviations. See its README
for the capture workflow.
