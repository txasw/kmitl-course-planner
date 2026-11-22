# Thai terminology

Thai UI copy uses the host registration site's own vocabulary as the canonical
source, so students see the same terms in the extension that they see on the
site. The terms below were taken from the host application (its rendered pages
and its bundled labels captured under the private working material). Keep new
Thai copy consistent with this list.

| Concept                   | Canonical Thai | Note                                                 |
| ------------------------- | -------------- | ---------------------------------------------------- |
| Faculty                   | คณะ            |                                                      |
| Department                | ภาควิชา         |                                                      |
| Curriculum                | หลักสูตร         |                                                      |
| Class year                | ชั้นปี            |                                                      |
| Academic year             | ปีการศึกษา       |                                                      |
| Semester                  | ภาคการศึกษา     | Not ภาคเรียน.                                         |
| Section                   | กลุ่มเรียน        | Not ตอน or ตอนเรียน.                                  |
| Subject category          | หมวดวิชา        | The by category tab.                                 |
| Subject id                | รหัสวิชา         |                                                      |
| Subject name              | ชื่อวิชา          |                                                      |
| Credits                   | หน่วยกิต         |                                                      |
| Lecture (lect_or_prac ท)  | ทฤษฎี           |                                                      |
| Practice (lect_or_prac ป) | ปฏิบัติ           | Not ปฏิบัติการ.                                         |
| Seat full                 | เต็ม            | The API sends the marker เต็ม/Full.                   |
| Seat closed               | ปิด             | The section is not open for enrollment.              |
| Instructor                | ผู้สอน           | English Instructors; not Teachers or อาจารย์ผู้สอน.     |
| Room                      | ห้อง            |                                                      |
| Building                  | อาคาร          |                                                      |
| Plan (a saved timetable)  | ตาราง          | English label Plan; the domain type stays Plan.      |
| Unscheduled section       | ไม่มีคาบเรียน     | A section with no meeting, such as an online course. |
| Clash (time or exam)      | ชน             | English clash; not conflict or overlap.              |

English copy names two meetings or two exams at the same time a clash, as in Time
clash, Exam clash, No clashes, and Hide clashes, and never conflict or overlap, so
one idea reads as one word on every surface. Code identifiers and translation keys
keep their conflict names; the rule covers the copy alone, and the tone test fails
on conflict or overlap in any English value.

Copy that is the extension's own and has no host equivalent (empty and error
states, section state badges, and the like) follows the plain, formal tone in
the project brief rather than inventing host style vocabulary.
