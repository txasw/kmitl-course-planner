# kmitl-course-planner

## 1.5.0

### Minor Changes

- 2753b10: The catalog remembers the hide full, hide conflicting, and hide unscheduled toggles across page
  reloads, while the text, day, and credit filters still belong to the current search. The empty
  timetable notice now sits on a card with a tinted icon and offers a Go to search action that opens
  the search form beside the grid, or the courses pane on a phone. The preview poster shows the same
  notice without the action.
- 359c2e1: The catalog can sort the courses inside each subject type heading by subject id, by most open
  seats, or by earliest start, from a Sort by control beside the filters. Clearing the filters keeps
  the chosen order. Each heading now names how many courses it holds and can be collapsed to set a
  group aside; a new search opens every heading again.
- be7b4c7: Copy registration list, in the selected courses heading and in the plan menu, copies the plan as
  plain text with one line per subject: the subject id, its name, and every section to register,
  listing both the lecture and the practice section of a pair. A student can read from it while
  entering the plan into the official registration system. The details of a planned section and the
  block's right click menu also gain Copy subject id. A toast confirms each copy.
- 9e4ad97: Note when a plan's credits leave the usual load. The plan summary bar shows the credit total in
  the warning color with a short note when it falls below 9 or rises above 22 credits in semester
  1 or 2, or rises above 9 credits in semester 3, the special term. The numbers follow clause 14.4
  of the KMITL undergraduate regulation B.E. 2565. An empty plan carries no note, the total
  includes sections with no meeting, and the note is advice only: nothing is blocked, since final
  year students and approved loads may sit outside the range.
- 2baacfe: The catalog filter now finds sections by instructor, room, or building as well as by subject id
  and name. A match on an instructor or a place narrows each course to the sections that match, and
  the field hint reads Code, name, or instructor. A Clear filters action appears whenever the text or
  any filter narrows the list, and clears both at once.
- d6031a6: The details of a planned section now end with a link, View in the official timetable, that opens
  the registration site's own listing for that subject and term in a new tab, so a student can check
  the source next to the plan. The planner stays open where it was, and the link only opens the page.
- 1aed2b6: Creating a plan now offers year and semester selects that open on the searched term, and the
  default name follows the chosen term until it is edited. The delete prompt states how many sections
  the plan holds and that the delete cannot be undone, and each plan in the switcher shows its credits
  and subject count.
- 4c15b11: Edit the whole week on a narrow timetable. When the timetable is narrower than 640 px, a
  รายวัน or รายสัปดาห์ (Day or Week) toggle sits above it. The day view stays the default; the
  week shows every day as a column with the time running down, and keeps every edit action: drag
  a block to move or remove it, see the sections of a dragged course as slots, and swap past a
  conflict. The choice is remembered for the next visit. From 640 px the landscape week shows as
  before and the toggle is hidden.
- ebdb4c8: Frame and scale the preview poster to its stage. The preview now sits on a quiet grey stage
  with a framed poster that grows up to twice its layout size on a large screen, while the
  exported image stays at the exact template pixels and carries no frame. A stage taller than
  wide, as on a phone or a narrow window, opens on the portrait phone wallpaper until a
  template is chosen. Below 900 px of stage width the neighbor previews at the edges give way to
  the full poster width, paged by swipe and by larger template dots. While an image is being
  created, the pressed action reads กำลังสร้างรูปภาพ, Creating image, and the sharing actions
  wait until it finishes, so a second press cannot start another capture.
- fbfd292: A section dropped on the timetable while it conflicts no longer vanishes at once. Its hatched
  footprint gives a short shake and fades over 200 ms while the feedback strip states the reason
  and offers alternatives. With reduced motion the footprint only fades, with no movement.
- 4a5a1ba: The panel header now shows whether your latest plan change is saved in this browser, beside the
  plan switcher. On a phone it shows the icon alone. When a save fails, one message says so and
  offers to try again, and the indicator stays as a button that saves again until a save succeeds.
- 5df6e2a: The search form selects now carry a small leading icon, so the year, semester, faculty,
  category, and curriculum fields are easy to tell apart at a glance. The icons are decorative
  and screen readers continue to announce each field by its label.
- adfb9a7: Preview gains share image, which sends the poster through the system share sheet wherever the
  browser can share a file, such as Chrome on Android. If the image takes too long to create for
  the browser to open the sheet, a toast offers to share the ready image with one more press. On a
  phone the sharing toolbar now sits at the bottom of the preview within thumb reach, as one row of
  icon buttons.

### Patch Changes

- c4e94e6: The meeting place now shows the readable building name, such as สำนักหอสมุดกลาง, instead of an
  internal code such as D01, and leaves the building out when the room already names it, so a block
  reads D-510 rather than D01 D-510. Plans saved earlier are not marked as moved to another room on
  their next check.
- ed0c47f: A section or search from another semester now states the mismatch in one sentence, such as
  ตารางนี้เป็นภาคการศึกษา 1/2569 แต่กลุ่มเรียนนี้อยู่ในภาคการศึกษา 2/2569, and its action says what it
  will do: เปิดตารางภาค 2/2569 when a plan for that semester exists, or สร้างตารางภาค 2/2569 when it
  will make one. The day loads in the stats bar and the poster footer read 6 ชม. in Thai and 6h in
  English. The segmented controls and day chips use even 4 px insets with matching inner corners.
- 994d062: The curriculum select tells apart revisions that share a name by adding the revision year, newest first, and the curriculum id when the year is the same.
- 0d215bf: When the background service answers with an empty or unexpected reply, for example while the
  browser restarts it, the panel now shows the usual connection error with a retry action instead
  of failing on the reply.
- 9872fa8: The brown, bronze, and slate subject colors looked grey on the timetable and are replaced
  with deep cyan, olive, and berry, so every block reads as a color against the panel.
  Subjects that used one of the three retired colors now show one of the new ones, in the
  editor and in exported images. Every other subject keeps its color.

## 1.4.0

### Minor Changes

- 04f2e55: Open block details as a bottom sheet on touch screens at any width. A tablet or a touch
  laptop now gets the same sheet as a phone, with acknowledge and remove from plan as large
  targets pinned at its foot, while a mouse at 640 px and up keeps the popover beside the
  block. The popover now pins its actions below a scrolling detail list too. Either form
  moves focus to its heading on open and back to the block on close. The remove action in
  the details reads นำออกจากตาราง, Remove from plan, so it no longer shares a name with the
  remove control on the block. The hover card on a block stays open while the pointer moves
  onto it, so a long remark can be read and selected.
- 0ed52a3: Open block details as a bottom sheet on narrow screens. Below 640 px, tapping a placed
  block raises its full details from the bottom of the screen instead of a popover squeezed
  beside the block, with the acknowledge and remove actions pinned at the foot of the sheet.
  The close button, a tap outside, Escape, or a downward swipe on the sheet header closes
  it, and the planner stays open behind it. Escape in a nested popover or sheet now closes
  only that layer.
- b33b2e5: The search form now sits at the top of the course list, and the separate search column is
  gone, so the timetable gets the width it needs on laptops and tablets. From 1024 px the
  course list is docked beside the timetable, and on narrower windows it opens as a side
  sheet with a title, the number of courses found and a close button. The course list is
  shown once at every width, so each section can be dragged from exactly one place.
- 0f72b90: On screens 1024 px and wider, a hidden course list now folds into a slim strip at the left
  edge of the panel instead of disappearing. The strip shows the number of courses found, or
  a small busy dot while a search is running, and a click, tap, Enter or Space brings the
  list back as it was. The hide button moves to the left end of the course list header, on
  the same spot as the strip's icon, so hiding and showing the list happen at one point.
  Nothing opens or closes during a drag, a quick double click no longer undoes itself, and a
  browser zoom that crosses the 1024 px width keeps keyboard focus inside the panel. Below
  1024 px the header button still opens the course sheet.
- 17b2a71: On screens 1024 px and wider, pointing at the strip of a hidden course list, or reaching it
  with the keyboard, now shows a thin shadowed edge of the list behind it as a hint. Only a
  click, tap, Enter or Space opens the list. Opening slides the list in from the left edge and
  hiding slides it back out, without a bounce, while the timetable changes width in one step.
  With reduced motion turned on, the list and the hint appear and disappear at once.
- 6a0484c: Remove a placed section by dragging its block back to the course list. While a block is
  dragged on a wide screen, the docked catalog column becomes the remove zone: the list dims
  under a dashed red frame labelled วางที่นี่เพื่อนำออกจากตาราง, which turns solid with
  ปล่อยเพื่อนำออก while the block is over it. On narrower screens, and while the column is
  hidden, a bar across the bottom of the panel takes the drop instead. The small floating remove
  target is gone. A drop removes the section and its paired section together, with undo.
- fc1953a: Course cards in the search results now start collapsed to one line with the subject code, the
  name and the credits, so a long result is quicker to scan. Click the card, or press Enter or
  Space on it, to open its sections; several cards can be open at once. A result with one course,
  or a filter that matches a subject code exactly, opens that card by itself. Dragging a collapsed
  card onto the timetable still shows every section as a slot, and on a tablet a vertical swipe on
  a card now scrolls the list.
- bd45293: Keep the planner clear of the notch, the rounded corners and the home indicator on phones.
  The panel, the bottom bar, messages and the Planner button now stay inside the screen's safe
  area. On windows narrower than 640 px, messages sit above the bottom bar instead of covering
  it, and the conflict notice with its alternative sections floats above both. While a placed
  course is dragged on these windows, the bottom bar turns into the remove area, so dropping the
  course on it takes the course out of the plan with the usual undo.
- 8fc4223: Fit the plan menu, the display options and the search to a phone screen. Below 640 px the
  plan menu and the display options open as bottom sheets that span the screen width and
  close with their close button, a tap on the dimmed backdrop, or Escape. An open search
  form now fills the course pane, with the search button pinned above the bottom nav so it
  stays in reach on a long form; the results wait hidden underneath and keep their place in
  the list. After a search, editing it again shows ยกเลิก, Cancel, beside the search button,
  which folds the form back under the current search. Course rows on a phone show only
  their add button, since dragging to the timetable is not available there.
- c5fe4cf: Show one pane at a time on windows narrower than 640 px. A bottom bar switches between the
  course list, the timetable and the selected courses, with the number of courses found and the
  number of selected subjects on its buttons. The planner opens on the timetable when the plan
  already has courses and on the course list otherwise, and adding a course keeps the list in
  view. Each pane keeps its place while another is shown, so the list returns at the same scroll
  position. On these narrow windows courses are added with the add buttons rather than by
  dragging, since the timetable is in its own pane.
- 12088b5: A collapsed course card now shows a second line with its section count, the days it meets and
  whether any section fits your timetable: how many can be added, that every section clashes, or
  that every section is full or closed. A course already in your timetable shows the section you
  chose and its first class time instead. Expand all and Collapse all in the result summary open or
  close every card the filters show at once. Show in the list in the feedback strip now opens the
  course list when it is hidden and opens that course's card.
- ee3d016: Rest the mouse on a collapsed course card to see where its sections would land on the
  timetable before opening it. Each section that fits shows a dotted green outline with its
  section number, a section that clashes with the plan shows a dotted red outline with a
  faint hatch, and a full or closed section shows a dotted grey outline. Focusing the card
  from the keyboard shows the same preview. The preview appears only when the course list
  sits beside the timetable, never for added courses or courses from another term, and it
  clears when the pointer leaves, the list scrolls, a drag starts, or Escape is pressed. The
  hover outline of a section row is now dotted as well, so a dotted outline always means a
  preview rather than a place to drop.
- c5222f9: Filter the catalog to the sections open to your curriculum. The filter menu gains a
  switch, เฉพาะที่เปิดให้หลักสูตรของฉัน, Only sections open to my curriculum, which keeps
  the sections whose curriculum groupings in the current search include your curriculum and
  class year. The first time it is turned on, it asks for your faculty, department,
  curriculum, and class year, prefilled from your last class search, and remembers the
  choice. The note under the switch states that it reads the current search only. Block
  details now list the curricula and class years a section is open to, under เปิดให้, Open
  to.
- f0485c3: Show the timetable one day at a time when it is narrower than 640 px, as on a phone. A row
  of day chips above it keeps the week in view, with a dot on each day that has a class and a
  red dot on a day with a time conflict, and Saturday and Sunday appear only when a class falls
  on them. The view opens on the first day with a class, each block takes the full width, and a
  day with no class says so. A sideways swipe over the timetable also changes the day.
- ce4a847: Every place a drag can land now shows from the moment the drag starts. A section that fits
  draws a dashed green outline around the timetable, which turns solid once the pointer is over
  it. A swap target has a solid orange border, an exchange icon and the label สลับเป็นกลุ่ม with
  the incoming section, and a section a placed block can move to reads ย้ายไปกลุ่ม with its
  number. A dragged block leaves a dashed outline where it came from, and putting it back there
  cancels the drag without a hint. A screen reader hears one sentence at drag start naming
  where the drag can go. On tablet widths the open course list slides aside to a narrow edge
  while a section or course is dragged out of it, then returns at the same scroll position.
- d7e4cd1: The timetable now opens on the 08:00 to 18:00 working day, Monday to Friday, and widens
  only for classes in your plan or in the current search results that fall outside it.
  Saturday and Sunday rows appear only when a class needs them. The grid no longer shifts
  while you hover a section or drag one, and on 1280 and 1366 px laptops the working day fits
  without a horizontal scroll. A search with evening or weekend classes scrolls sideways at a
  readable size instead of shrinking every block.
- 1bffe20: When a registration result page is loaded directly, by a reload, a bookmark, or a shared
  link, the prompt beside the Planner button now offers to open that search in Planner.
  Its action opens the catalog with the same search already run, so its sections can be
  placed on a timetable, and the other search tabs keep their last search. Changes that
  still need review are offered first, and the offer hides when the page moves to another
  route.
- a276633: A short prompt now appears beside the Planner button about two seconds after a
  registration page loads. It names the plan you were working on and how many subjects it
  holds, an empty plan to fill, changes that still need review, or the planner itself when
  there is no plan, and its action opens the panel at the matching place. It shows at most
  once per page load, never while the panel or the welcome is open, and hides by itself
  after a few seconds. Do not show again turns it off for good.
- debcb93: Show exam dates on every section row in the catalog. A row lists its midterm and final
  windows in the Buddhist year, for example กลางภาค 21 ส.ค. 2569 09:30-12:30, or reads
  จัดสอบเอง, Arranged by instructor, when the section announces neither, so a likely exam
  clash is visible before adding. The registrar's exam note, when present, shows on one
  line. Section rows with a long instructor list now stay inside the course card, so their
  add control is no longer cut off.
- 6b3550e: Add an optional exam schedule to shared posters and copied text. The display option แสดงตารางสอบ,
  off by default, lists every midterm and final in date order below the timetable, followed by the
  subjects the instructor arranges, so one image or one message carries both the class timetable
  and the exam dates. On a small canvas the poster lists the earliest exams and counts the rest,
  while copied text always carries every exam.
- 8fbdd43: The planner header now fits every screen from 320 px wide on one row, so the close and
  preview controls are always on screen and leaving the planner stays one tap away on a
  phone. The plan name shortens first and shows its semester under it. Below 640 px the
  edit and preview choice becomes a pencil and an eye, and below 1024 px the language
  choice moves into a More options menu. The language toggle now uses a quieter look so the
  edit and preview choice is the one orange control in the header. Header controls grow to
  44 px under touch.
- a9569c7: From 1024 px the docked course list can be hidden with the Hide courses control at its
  top, so the timetable gets the full panel width. While it is hidden, the header shows a
  Courses button with the number of courses found, and choosing it brings the list back
  where you left it, with the same search and scroll position. On narrower windows the
  same button opens the course list sheet and now shows its label and the course count.
- 3f8d114: On first install, the registration search page opens in a new tab with a short welcome
  that explains the three steps of a plan and how to open the planner again. Start
  planning opens the panel at the course search. The welcome shows once, only in that
  tab, and never after an update. Without access to both KMITL sites no tab opens, and the
  welcome shows on the next visit once access is granted.
- 5a23322: The launcher is now a rounded orange pill with the calendar icon and the Planner label,
  at least 48 px tall, and lifts slightly on hover and keyboard focus. Until the panel is
  first opened, a student with no saved plan sees a ring pulse twice around the launcher
  on each page load, starting only after the welcome closes. With reduced motion the ring
  shows still for two seconds instead, and the launcher does not lift.
- 652047c: Suggest a timetable from a curriculum search. After a search by curriculum and class year,
  the catalog column offers แนะนำตาราง, which lists up to three conflict free timetables of
  the curriculum subjects in group 2, the faculty required, curriculum required, and
  curriculum elective subjects. GenEd and free electives are never chosen, full or closed
  sections are never chosen, and no two chosen sections clash in class or exam times. Every
  section already in the plan is kept. Choose whether to fit the most subjects or the most
  credits, and a shape such as mornings, afternoons, or fewer days; each card shows a small
  weekly grid, its credits, days, earliest start, latest end, and gaps, and the subjects it
  leaves out with the reason. Using a card creates a new plan beside the current one, and
  the undo in the toast removes it again.
- 31e394e: Warn before sharing a plan whose entries changed or were not found at the last check. In
  preview, a slim notice under the sharing tools states how many entries to review and offers
  ดูรายการ, which returns to edit mode and opens the check details. In edit mode each changed
  entry can be acknowledged or removed from its block. The notice sits outside the exported
  image and never blocks a download or a copy.
- 5f35b72: Announce search outcomes and confirm adds made over the course list. A screen reader now hears
  the result of each search the student submits: the number of courses and sections found, no
  courses found with the searched term, or that loading failed, and the result of a retry after a
  failure. A refresh replaces the result without repeating it. On a tablet or a phone, where the
  open course list covers the timetable, adding a section shows a short message naming the
  subject and section with a View timetable action that closes the list, and the list stays open
  for the next pick until then. Each add is spoken once.
- d01aa59: Each section in the course list now shows its enrollment conditions, such as the faculty,
  curriculum, or student group it is limited to, under the label เงื่อนไข. The first rule
  sits on one line, and a control lists every rule when there are more or the line is cut
  short. Program qualifiers such as <สองปริญญา> show as written. The remark shows its first
  line under หมายเหตุ with a labelled control for the rest, replacing the small unlabeled
  info icon. The section detail popover lists every condition in the same warn tone, and
  the unscheduled shelf shows the conditions and remark while editing. Preview and
  exported images do not include them.
- 18b1bb1: Show how old the search results are and offer the last search again after a reload. The summary
  bar reads ข้อมูล ณ with the time the courses were fetched, which turns to a warning once the data
  is older than the ten minute cache. The results refresh moves into the bar as โหลดผลค้นหาใหม่ and
  keeps focus while it loads. After a page reload the last search reopens folded into its bar with
  ค้นหาอีกครั้ง, instead of the full form, unless the host page names another term.
- d3161d7: Pressing Escape in a reopened search form now folds it back under the search bar and keeps the
  planner open, and a further Escape closes the planner as before. Retry and Refresh now keep
  keyboard focus on the search bar while the courses reload, so the place in the panel is not
  lost. When the server rejects a search, the error offers Edit search instead of a retry that
  would fail again, and a rejected subject id opens that field directly.
- 158ab70: Pressing search now folds the search form into a short bar at the top of the course list right
  away, so the press is visibly accepted even on a small laptop screen or when the answer comes
  from the cache. The bar names the search tab and the term, shows that the search is running,
  and then shows the number of courses found. The bar stays in view while the list scrolls, and
  Edit search opens the form again without moving the list. Cancelling a slow search brings the
  form back. For half a second after a search the results ignore clicks, so a double click cannot
  land on a course that has just moved under the pointer.
- 5b1857c: The search tabs are now underline tabs named หลักสูตร, รหัสวิชา and หมวดวิชา that fit on one
  line, and the arrow keys move between them. The search button sits directly under the last
  field at full width. When it cannot search yet, it turns grey and a line under it names the
  field still to fill, such as the faculty or the subject category, and screen readers read that
  line with the button. While a search is running, the button asks you to wait instead of
  starting a second search. A new Clear search action empties the fields of the current tab
  and keeps the term and the results already shown.
- 2fc2aca: Name the running search in the summary bar. The bar now reads what was searched, such as
  หมวดวิชา and the category name, รหัสวิชา and the code, or the curriculum short name, instead
  of only the tab. The scope sits beside the term as chips that never truncate: the faculty
  acronym or ทุกคณะ for a category search, and ทุกหลักสูตร with ชั้นปี 4 or ทุกชั้นปี for a
  curriculum search. A long name wraps to two lines and the scope stays in full, and a screen
  reader hears the name, the term, and each chip when focus lands on the bar.
- 30273ad: Show seat demand during pre registration. A section whose pre registrations exceed its
  capacity carries a small chip beside its seat line, for example ล่วงหน้า 171 คิว 83. The
  section details on the timetable list the counts the registration site shows under รับ, ลง,
  ล่วงหน้า and คิว, and state when pre registrations exceed the capacity. The counts are shown
  as given, with no estimate of the chance of getting a seat.
- 86df4b1: Show seats as one always visible line on every catalog row and in the block hover card, such
  as ว่าง 12 จาก 45 or 12 of 45 open, ไม่จำกัดที่นั่ง for a section with no seat limit, and เต็ม
  เพิ่มไม่ได้ or ปิด เพิ่มไม่ได้ for a section that cannot be added. The seat count no longer hides
  behind an icon on a narrow row, and a placed block reads its seats the same way its catalog row
  does.
- 2c59c28: Add sections from the comparison table. A last column, pinned to the trailing edge, adds a
  section through the same checks as the course card. A section that clashes with the plan keeps
  its add button, and pressing it states the clash in the row and adds nothing. An added section
  shows เพิ่มแล้ว, a full, closed, or duplicate subject section says it cannot be added, and a
  section from another term offers the switch to a plan for that term. A screen reader hears each
  outcome once from the table itself, and closing the table after an add returns focus to the
  course card.
- ba82309: Compare sections on a phone. Below 768 px the section comparison opens as a full height bottom
  sheet with its table turned: the field names sit in a first column that stays in view, and the
  sections are columns that scroll sideways beside it, two side by side. A sideways scroll stops on
  a section edge, the row of section codes stays in view as the fields scroll under it, and the last
  row adds a section through the same checks as the wide table. From 768 px the comparison stays the
  table with one row per section.
- 045b511: Compare the sections of a course in one table. An open course card with two or more sections
  starts with a compare sections action, which opens a table with one row per section: its time
  and place, instructors, seat demand, exams, conditions, the curricula it is open to, and its
  status. The header row and the section column stay in view while the table scrolls. A switch
  keeps only the sections that can be added now, and the rows sort by earliest start or by most
  open seats. Escape closes the table only and returns focus to the action.
- 7d55902: The block detail popover now shows every class time with its day, time and room, the
  type and credits, the instructors, the seats from the latest check, the midterm and final
  exam dates, the exam details, the conditions, the remark and when the section was last
  checked. A section with no announced exam date reads as arranged by the instructor. The
  hover card shows the same list in a shorter form, so the two always agree. An entry that
  changed and also clashes on an exam now shows both states in the popover.
- d7c9792: Each section row in the course list now shows one status badge with its label always
  visible: other term, closed, full, added, duplicate subject, time conflict, or exam clash,
  in that order of priority. A full or closed section no longer also shows a conflict, since
  it cannot be added. A conflict is explained in a soft red box under the section details,
  the lecture or practice tag is quiet text, and the seat line is visible at every width.
  The add button of a section that cannot be added stays reachable by keyboard and reads
  out the reason.
- ff448c7: Add plan view tabs above the timetable on tablets and laptops: ตารางเรียน, Timetable, and
  วิชาที่เลือก, Selected courses, with the number of placed subjects in its label. The
  selected courses view lists one card per subject with its sections, meeting times and
  places, kind and credits, instructors, seats, exam dates, enrollment conditions, and any
  change, missing, or conflict badge, so the plan can be reviewed and managed without the
  grid. Remove on a card takes out the subject, both halves of a pair together, with the
  usual undo, and focus moves to the next card. The tabs follow the arrow keys, Home, and
  End. Preview and phone widths show no tab row.
- a611bbd: Share one academic year and semester across the three search tabs. The term now sits once above
  the tabs, so switching tabs no longer changes the term a search runs under, and a new plan takes
  the same term. A search saved by an earlier version keeps the term of the tab it last searched.
- b4babc5: Replace the plan footer and the revalidation banner above the grid with a stats bar under
  the plan. It shows the credit total as the lead number, the subject count, and the clash
  state: ไม่มีรายการชนกัน when nothing clashes, or a ชนกัน button with the count that shows the
  first clashing section on the timetable. The end of the bar states when the plan was last
  checked, with an icon button ตรวจสอบอีกครั้ง. An offline check reads in warn that the plan
  shows saved data and offers a retry, and the same status and retry sit in the preview
  toolbar, outside the exported image. A check the student starts is announced once to screen
  readers, and the grid gains the banner's height.
- 6561211: When a wide search result makes the timetable scroll, the day labels and the hour labels now stay
  in view at the edges of the timetable, and a soft fade marks each side that has more to scroll to.
  The hour and quarter lines are drawn once across every day, so they line up in every row on screen
  and in exported images, with a stronger line at 12:00 and at the start and end of the day.
- 75d02ad: Compare plan suggestions side by side. On a tablet or a desktop the suggestion cards now
  sit next to each other in a wider dialog, with the stats one per row in the same order so
  each stat lines up across the cards, and every card draws the same hours on the same
  columns. On a phone the cards page one at a time with a swipe across the timetable, the
  arrows, or the dots, and each card runs time downward so every class is in view. Any card
  opens full size before you use it, and the dialog remembers the goal and the schedule
  shape you last chose.
- d34ee2d: Add the Summary plan view, which opens on the plan's exam schedule. Midterm and final exams
  are listed by date with the weekday, time, subject, section, and exam detail, and a day with
  two or more exams carries a note. A row whose exam clashes with another subject has a red
  edge and names that subject, and the subjects whose exams are arranged by the instructor are
  listed apart. Summary is the third tab above the timetable on wider screens and the fourth
  item of the bottom nav on phones, and both carry a red dot while the plan holds an exam
  clash. An empty plan shows a Go to courses action that opens the course list.
- 28f5bc5: Open the planner from the extension icon in the browser toolbar, or with Alt+Shift+P
  (Option+Shift+P on macOS). On a registration page the panel opens in that tab. From any
  other tab, the registration search page opens in a new tab with the panel already open.
  The icon never closes an open panel, and Firefox pins it to the toolbar. The extension
  asks for no new permissions.
- 899d4fc: Drag on a touch screen with a long press. On a tablet or a touch laptop a swipe that starts on
  a section row, a course card or a block on the timetable now scrolls the list or the timetable,
  and holding a finger still for a quarter second picks the item up. The item reads as pressed
  before it lifts, the grab card rises above the finger so it stays visible, and the device gives
  a short vibration where it can. A tap no longer opens the hover preview or the hover card, and a
  long press on a block no longer opens its context menu. Dragging with a mouse is unchanged.
- 9ac925e: Set the panel text on a fixed 14 px base with a pixel type scale and Thai friendly line heights,
  so its size no longer follows the registration site or the browser text size setting. The panel
  now uses two font weights, regular and semibold, and the catalog group headings and the plan menu
  term labels are no longer set in capitals. Exported images keep their layout.
- f46710e: Show plan changes without being asked. When the check on opening the panel or switching plans
  finds a change you have not seen, the updates dialog opens on its own, once, at a quiet moment:
  it waits while you drag, while a menu, popover or sheet is open, and while you type in the
  search form. A check you run yourself that finds a change opens the dialog right away. The check
  after your first add creates a plan stays quiet, and a check that could not reach the service,
  fully or in part, never opens the dialog.
- ed58741: Review plan changes in one updates dialog. The details action on the check summary, and the
  review action shown before sharing, now open a dialog that lists each section whose time, room,
  exam, paired section or open status changed, or that is no longer listed, grouped from new
  clashes and missing sections down to other changes. Each item shows the old and the new value,
  with exam dates in the Buddhist year, and offers show on timetable, which closes the dialog and
  points at the block on the grid. A section no longer listed can be removed from the plan there,
  with undo. Mark all as reviewed clears the changed badges, review later keeps them, and check
  again runs a fresh check. The dialog remembers what is still unreviewed across reloads, and on a
  phone it opens as a full height sheet.
- 9bc0edb: Keep unreviewed plan changes one action away. While a section in the plan still has a change to
  review, a chip that counts the items sits at the right of the plan view tabs and reopens the
  updates dialog. On a phone the same chip heads the plan pane, and the timetable item in the
  bottom nav carries a dot whose meaning is part of its name for screen readers. A screen reader
  hears the count once when the chip first appears. The chip and the dot leave once every change is
  acknowledged and every section no longer listed is removed.
- d4f9b76: Spell out the weekly hours in block details. Under the credit string, such as 3(2-3-6),
  the detail popover and its bottom sheet now read the lecture, practice, and self study
  hours per week, so the notation no longer has to be decoded by hand.
- 95f4a18: Show the weekly workload and free periods. After the exam schedule, the Summary view now
  lists the plan's lecture, practice, and self study hours per week from each subject's credit
  notation, the class time of each day, the weekdays with no class, and the breaks of three
  hours or more between two classes, such as Wednesday free 10:00 to 13:00. When a credit
  notation states no hours, the totals say how many subjects they leave out. The stats bar under
  the plan also lists the free weekdays. Neither appears on the shared image or the text export.

### Patch Changes

- f8360b2: Keep the panel in place when the catalog scrolls a course into view. With several course cards
  open, a scroll into view that the results list could not finish on its own moved the whole panel
  up, the column header and the timetable with it, and nothing scrolled it back. The list now holds
  all of its own content, so only the list scrolls.
- 8b239bf: Make the catalog sheet modal on narrow windows. The closed sheet no longer holds hidden tab
  stops, the open sheet takes focus and keeps Tab inside it while the timetable under the dimmed
  area is set aside, and Escape closes only the sheet, with focus back on the header Courses
  button, so the planner stays open.
- 201b8e1: Make every control easier to hit. Small icon buttons such as the toast close, the plan actions,
  the filter chips and the template pager dots now take at least 24 px, and on a touch screen
  every control grows to 44 px, including the add rail, the search tabs and the header buttons.
  The rename, duplicate and delete actions in the plan menu now show without hovering on a touch
  screen. On a touch screen a block on the timetable no longer shows its small remove button;
  tap the block, or focus it and press Enter, to open its details with the remove action.
- 39bc657: Refresh dependencies to the newest release of their current major, including the runtime
  React, Zod, Zustand and lucide-react, and clear the published advisories in the build and
  test tooling. No user facing behavior change.
- fd03545: Short blocks on the edit timetable no longer cut their bottom line through the text. When a
  block is too short for every detail, it hides whole lines instead, starting with the subject
  code, which the hover card and the block details still show.
- 6b1a3ab: Pressing Escape while a dropdown list on the search form is open now closes only the list and
  keeps the planner open. A second Escape closes the planner as before.
- b57c2e5: Label an exam only clash in the catalog as an exam clash instead of a time conflict. The
  section row now names the blocking section, the exam type, and its date in the Buddhist
  year, counts any further conflicts, and the hide filter reads Hide conflicts so it covers
  exam clashes too.
- b85a463: Exported and copied timetable images no longer carry the update dots, hatching, or red outlines
  from edit mode, so a shared image shows only the plan. The footer of the image now states when the
  data was last checked, or that it has not been checked yet, and adds a short line when a section
  was not found at the last check or two sections clash. Edit mode keeps every marker, and the copied
  text still marks a section that is no longer listed.
- cc94a12: Keep the feedback strip readable and reachable at every width. Its notices now wait while
  the pointer rests on the strip or focus is inside it and resume with the time left, and
  each one ends with a close control, ปิดข้อความ, Dismiss message. Below 1024 px the strip
  floats at the foot of the open course sheet, or of the timetable while the sheet is
  closed, above the dimmed backdrop and above a toast, so its alternative sections can be
  tapped and a blocked add moves focus to the first of them; a cross term add moves focus
  to its switch action too. On wider screens it stays at the top of the timetable. Show in
  the list now opens the sheet or brings back the hidden course column, scrolls the course
  into view and moves focus to it, and when the current results no longer list the course,
  the strip offers ค้นหารายวิชานี้, Search for this course, which runs a search by its
  subject code in the plan's term.
- 38c3c42: Keep keyboard focus inside the planner after an add, a remove, or a closed menu. An add
  from a course row or its grip now lands on the card's toggle as the card collapses, and a
  remove from the card lands there too. A blocked add moves focus to the first alternative
  in the feedback strip, and focus returns to the row when that notice clears. A remove
  from a block, its details, its context menu, or the unscheduled shelf lands on the next
  placed section in time order, or on the grid when none is left, and closing the context
  menu returns focus to its block. Tab no longer wraps to a hidden control, and focus that
  falls out of the panel is pulled back, so Tab and Escape keep working. The revalidation
  detail list now opens as a dialog outside the status line, so a screen reader no longer
  reads the whole list as a status update, and Tab stays inside it.
- a367667: Make form controls easier to find and read. Search fields, comboboxes, the filter field, the
  plan name field and the switch off track draw a darker boundary that meets the 3:1 contrast
  bar, and placeholders read in full strength secondary text. The catalog filter field has a
  visible label, and duplicate subject and different term section rows use a muted background
  instead of fading, so their reason text and the switch term action stay readable.
- 8f8000f: The extension is now named KCP: Course Planner for KMITL. The new name shows in the browser
  toolbar, the store listings, the panel title, the Planner button label, the welcome message, and
  the credit line on exported images and copied text. The Thai panel title reads
  KCP: ตัววางแผนตารางเรียน สจล.
- 7fc6df0: Screen readers now read the planner in the language chosen in the panel, whatever language the
  registration site declares, and read each Thai or English course name in its own language. The
  footer day load reads the full day name instead of its abbreviation.
- 3599277: Fit every popover and menu to the space on screen. The block detail popover, the plan
  menu, the catalog filter, the display options, the block context menu and the hover card
  now stay within the viewport width and height, and scroll inside when their content is
  longer, so a long plan list or a block with many changes stays reachable on a short screen.
- da338f0: On a first run the search form now opens on the next registration term, read from the registrar's
  current term, instead of the first semester of the newest year.
- c6600bc: The remove control on an added course now uses the same X as the remove on the timetable,
  shows its label, and tells screen readers which subject and section it removes.
- ced2fb2: Keep the catalog results reachable by keyboard at every layout tier. The results are now
  a region named ผลการค้นหา, Search results, and while they hold no control, before a
  search, while one loads, or after a search that found nothing, the region takes focus
  itself so the arrow keys can scroll a hint that runs past a short column. Below 1024 px
  the list leaves room at its foot for the floating feedback strip, so the last add button
  in a long list scrolls clear of the strip and the nav when it takes focus instead of
  staying under them.
- c9af6da: A section whose seat counts or teachers are all that changed upstream no longer shows the
  changed badge, since those counts move by the minute during pre registration. The seat
  figures still update on every check. A change to the time, room, exam, paired section, or a
  section that closed now keeps its badge until you acknowledge it, even after a later check
  finds nothing new, and the badge clears by itself if the registrar restores the old value.
- 47397f8: Keep the bracketed program qualifiers in section conditions, such as <สองปริญญา> and
  <Dual Degree>, which the sanitizer used to remove. Section remarks now show as plain text
  lines instead of raw markup, keep the text that comes before a formatted notice, and are
  limited to 1000 characters.
- 6be8ff0: Keep the term a search ran under. A search pressed before the registrar's current term arrived ran
  under the newest year and semester 1, and the late answer then moved the form to the next
  registration term while the summary bar still named the first one, so the next search or a new
  plan took a term the student had not chosen. A search now settles the term it ran under.
- 96afce7: A course whose saved search has no readable semester is no longer added to a first semester
  plan. Such an entry used to be accepted and then fail the next time the plan loaded.
- 8b56bc7: On a large screen the timetable day rows no longer stretch to fill the panel. Each row stops at a
  comfortable height, and a class block keeps its time and subject code just below the room rather
  than at the far bottom of the block. The timetable text also grows a step when the timetable has
  more width, such as on a 1920 px screen or with the course list hidden. Exported images are
  unchanged.

## 1.3.1

### Patch Changes

- 3f44ace: Refresh dependencies to their latest minor and patch releases: the runtime @floating-ui/react
  and lucide-react, and the tooling eslint, prettier, commitlint, and typescript-eslint. Force the
  transitive build dependency adm-zip to 0.6.0 through a pnpm override to clear GHSA-xcpc-8h2w-3j85,
  a high severity report against the 0.5 line; adm-zip is a Firefox tooling dependency and is not
  shipped in the extension. No user facing behavior change.

## 1.3.0

### Minor Changes

- 801fce5: Invert the timetable block hierarchy on the grid, since the row and the block's extent already
  encode the meeting time. The subject name is now the primary anchor at the top, the place
  (building and room with a location glyph) is promoted to the second line because it is
  recoverable nowhere else on the sheet, the section stays a corner chip, and the time demotes to
  quiet metadata at the foot beside the subject id. Under the measured fit a short block drops the
  subject id, then the English name, then the time, then the section chip, then reduces the name to
  one line, then the place, with the name never dropping; the place always outlives the name's
  second line and the time is kept present as a quiet foot line rather than deleted. Long names now
  hyphenate a forced break by their language instead of splitting a word with no hyphen. The change
  applies only where position encodes time; the hover card, block popover, catalog rows, and copy
  as text keep the time prominent. Recorded in ADR-0047.
- e853d17: Add a show subject id display option to the preview toolbar, off by default. It governs the
  preview poster, every image export, and the copy as text output, so a shared timetable reads
  clean without the numeric course code unless the option is turned on, and the id stays
  recoverable from the text export when it is off. The edit grid ignores the option and always
  shows the id for cross referencing against the catalog. When on, the id is still the first
  field to yield on a short block. Recorded in ADR-0046.

### Patch Changes

- 9484f67: Block text on the preview poster and its image exports no longer clips mid glyph. Each
  field now renders whole or is dropped by measurement in a fixed priority (subject id, then
  the place line, then the section chip, then the English name, then the name reduces from two
  clamped lines to one before it drops, with the time never dropped), a long name wraps and
  ellipsizes rather than clipping in a narrow portrait column, and Thai vowels and tone marks
  keep their vertical headroom. The image capture waits for fonts to load so the export matches
  what the fit measured. Recorded in ADR-0046.

## 1.2.0

### Minor Changes

- d4e6d53: Add a hover detail card on a placed block. After a short delay the grid opens a read-only
  card with the full detail set (times, room and building, teachers, seats, exam ranges, and
  verification state), so a look no longer needs a click on the info affordance; the click and
  keyboard paths to the block detail popover stay for pinning and actions. The card reads the
  same plan snapshot the popover reads, is positioned to the side so it never sits under the
  pointer, and carries a neutral info accent so it reads apart from the danger conflict card.
  Recorded in ADR-0044.
- 528246b: Redesign the timetable block to the approved direction: the time range is the colored bold
  anchor with a small clock glyph, the subject name is the primary full weight line, the
  subject id and place read as quiet metadata at the foot, and the section is a floating chip
  in the top right corner that steps aside for the controls on hover. The soft tint fill and
  solid left bar are unchanged, and the density rule still governs a short block, so the time
  and name never clip. One component serves edit, preview, and export. Recorded in ADR-0044.
- 5b40863: Redesign the timetable block with a clear hierarchy: the time range leads, the
  subject name is the primary content clamped to two lines, and the subject id, a
  section chip, and the place read as quieter meta at the foot. The block now shows the
  building alongside the room as the place, data it already carried but never rendered.
  The soft tint fill and solid left bar are unchanged, and the quieter meta uses ink
  soft, which clears the AA text bar on every tint. Recorded in ADR-0040.
- b7b1c1e: Tint the export template day-row labels with the traditional Thai day colours as a
  faint accent. The accent appears only in the preview template render, never in edit
  mode, and the block colours stay keyed to the subject so the two colour systems never
  compete. The label text stays legible on every day tint. Recorded in ADR-0042.
- ffb584f: Add fixed export templates for the preview poster. A download is now a named size
  rather than a screenshot of the window: Share 16:9, Phone wallpaper, Tablet wallpaper,
  and Print A4, each rendered at exact pixels independent of the viewport and the device
  pixel ratio. The preview scales the selected template to fit the pane, the picked
  template persists, and the file name carries the template. The honesty rules hold at
  every size: the unscheduled shelf, the credits, and the verification badges always
  render and are never cropped. Recorded in ADR-0041.
- 3250281: Move the undo for a removal, move, or swap into a toast in the bottom feedback region,
  where the eye already is on the block that just changed, rather than a strip at the top
  of the panel that went unnoticed. The toast names what changed, offers undo, and drains
  a ten second window wired to the undo timer. Hovering or focusing the toast pauses the
  window and its drain per WCAG timing, resuming on leave. It takes priority over ordinary
  toasts, which queue behind it, and reduced motion drops the draining bar for a static
  message and button. The pull back arrow stays the icon language of the catalog remove.
- d6f06fa: Redesign the plan menu creation flow. Create becomes one prominent full width tinted button
  at the top of the menu, and rename, duplicate, and delete move to per-plan-row actions that
  appear on hover and focus of each row, icon buttons with tooltips that name the plan; delete
  keeps its confirm. Import and export JSON stay at the foot. Every per-row action is keyboard
  reachable, since the row reveals its actions on focus. Recorded in ADR-0044.
- 80eb8ef: Add a portrait phone wallpaper export template with a transposed layout: days as columns
  and time flowing down, the natural fit for a tall canvas, so it fills top to bottom
  rather than a thin horizontal band. Orientation is a template property, not a free
  toggle, so every layout stays deliberate; the existing landscape phone template stays.
  Recorded in ADR-0043 (records ruling one).
- 032580c: Add a quiet monochrome credit to the bottom-right of every export, so a shared image
  carries its origin. It rides the honesty footer position, appears in every template
  including portrait, is part of the captured composition, and is not user removable. The
  ink-soft on surface pair clears the AA text bar. Recorded in ADR-0043.
- 67d4c15: Give the export poster a smart default window. It renders the 08:00 to 18:00 working
  day, extended to the hour boundary that clears any meeting outside it, and Monday to
  Friday, revealing Sunday for a Sunday meeting and both Saturday and Sunday for a
  Saturday meeting. This supersedes fit to content for templates, so a poster reads as a
  familiar working week rather than a band trimmed to whatever hours the plan uses. The
  fit to content display option is retired. Recorded in ADR-0043.
- 65516f2: Make every export canvas read in the orientation its name implies. The phone wallpaper landscape becomes a true wide 20:9 canvas (2400x1080, from the old 1080x2340) instead of a landscape table on a portrait box, and the tablet wallpaper splits into a portrait preset (2048x2732) and a landscape preset (2732x2048). Axis orientation now follows canvas orientation as one rule the module states once: portrait canvases transpose the grid, landscape canvases keep days as rows. Share 16:9 and Print A4 are unchanged.
- 6168be2: Make the export template picker the preview itself. The dropdown and the corner size label are gone. The preview pane now renders the selected template poster centered, full height and unclipped, with the previous and next templates as a constant narrow sliver at each edge, dimmed and slightly scaled down as continuation cues. Paging: left and right arrow buttons that disable at the ends, a pointer swipe, the arrow keys, a scroll wheel or trackpad swipe (one notch one page), and a dot radiogroup below for direct jumps with the template names as tooltips and Home and End. A caption carries the localized name with the exact output pixels. Only the selected poster renders eagerly and holds the capture; the slivers render from a deferred copy so a display option change updates the visible poster at once. Paging clamps at the first and last template, and reduced motion keeps the switch instant.
- 72b54e2: Add dismissal to every toast. A compact close button dismisses it, and a pointer swipe
  tracks the toast and fades it, committing the dismissal past a threshold or springing back
  under it. Dismissing an undo toast commits the removal, the same as its expiry. Escape
  while a toast control is focused dismisses it too, and reduced motion drops the swipe
  tracking, leaving the close button.
- 72b54e2: Coalesce consecutive removals into one undo toast rather than letting a second removal
  replace the first. The folded removals show as a count, the drain window resets, and undo
  restores every folded removal in reverse order, so one toast gives full recovery. No
  stacked toasts.

### Patch Changes

- a10c9df: The add control becomes a slim vertical rail on the trailing edge of a section row
  rather than a button in the wrapping controls strip, so it stays within the row
  bounds. The rail carries a plus icon and an aria-label and tooltip naming the
  section, routes a blocked add to the feedback strip like a drag, and shows disabled
  with the reason in the row body for a full, closed, or different term section rather
  than disappearing.
- 80eb8ef: Redesign the export time axis. Hour labels center on their gridline and read as an evenly
  ticked ruler rather than clustering left-aligned at the ticks, with a stronger rule at
  midday and the window edges. The axis size scales with the template type scale. Recorded
  in ADR-0043.
- 63ead08: Simplify the placed block chrome. The hover detail card made the block's info affordance redundant, so the info control leaves the block: the block itself is now the button that opens the pinned detail popover on a click or Enter or Space, and the quiet remove control is the only chrome that remains. The hover card never shows while a popover is pinned, so the two detail surfaces never appear at once.
- c22f9a1: Collapse a status chip to its icon when its label cannot fit a narrow row, with the label
  moved into a tooltip and kept in the accessibility tree, so the full name is always
  available. Swept across the seat, kind, and state chips in the catalog rows and the
  unscheduled shelf; the block already carried a compliant dot and label.
- 658da15: The collapsed added-course summary is now one expand and collapse control: a click
  anywhere on the summary toggles its sections, with button semantics, aria-expanded,
  and the chevron as the indicator. The remove control sits beside it rather than
  nested inside, since a button cannot contain a button.
- f4333b4: Redesign the drag conflict chip. The cramped red-on-red sentence becomes a compact card on
  the surface with a danger accent, naming which section clashes on one line and when it
  clashes on the next, with a count when more conflicts follow. It anchors off the cursor and
  stays distinct from the block hover card.
- 4ea09fa: Disable the show English names display option in English, where names already render in
  English so the option has no job. It reads as not applicable, keeps its stored state, and
  carries a tooltip stating why. The switch gains a disabled state that stays focusable so
  the tooltip reaches the keyboard.
- a99cd95: Quiet the catalog add rail. Add is the secondary path and drag is primary, so the rail
  now rests as a soft tinted column with the accent icon and fills to solid only on hover
  and focus, rather than a solid orange bar that dominated the card. It claims its own
  bordered column and never overlaps the row body, which clips rather than spilling into
  the rail at any card width.
- 7cdfbb0: Keep the subject name on a short timetable block. The block clipped from the foot
  inward, but flex shrink squeezed the tall two line name out first while the shorter
  subject id survived, which inverted the emphasis order. The time and the name are now
  pinned so the foot, the subject id, the chip, and the place, is the field that yields;
  the name keeps at least one clamped line, since the id is recoverable from the text
  export and the chip carries the section.
- 1dede4c: Point a tooltip away from the content of the popover that holds its control. The plan
  menu Duplicate tooltip rendered above its icon, over the plan list it belongs to, hiding
  the options being chosen. Tooltips now take a placement preference, and the plan menu
  action buttons point their tooltips below, away from the list.
- c9a3413: The four plan actions, create, rename, duplicate, and delete, are now icon only
  buttons with a tooltip and a mandatory aria-label, which fixes the label wrapping
  in both locales. The delete confirmation is unchanged, and the import and export
  JSON entries keep their text because file actions read better with words.
- 60ffd4b: Align the export poster footer and brand the watermark. The credits summary and the credit line now share one baseline row inside the poster's equal margins, the summary flush left and the watermark flush right, rather than stacking. The watermark mark becomes the extension's own icon, built from the same icon geometry as a monochrome single-color mark in the credit text colour: the rounded tile filled, the three light squares knocked out to transparency, and the accent square kept at reduced opacity, so the brand's figure and ground survive rather than reading as detached squares.
- 80eb8ef: Give each export template its own poster type scale, so the essential text fits its
  canvas rather than clipping at some sizes. The poster and grid set one font size and the
  block and axis text are em relative, so a template scales its whole type ramp from one
  number. The density rule still governs which field yields first, so the time and name
  never clip. Recorded in ADR-0043.
- d660e64: The remove control on an added course reads as a pull back: a compact, quiet
  undo-arrow icon rather than a bordered text button, since the ten second undo makes
  a remove reversible. Its aria-label and tooltip still state the plain action, and no
  confirmation is added because the undo covers it.
- 6829a3f: Style selected text inside the panel with the brand soft wash and ink text rather
  than the browser default. It is scoped to the closed shadow root, so it never
  changes selection on the host page, and it clears the AA text contrast bar.
- cc85665: Require an exact eight digit subject id in the by subject id search. The field
  shows a live digit counter, and a submit or Enter on a shorter id shows an inline
  message and focuses the field rather than leaving a silent disabled control. The
  earlier gate accepted one to eight digits, which the registration server always
  rejected with a length error, so a short search could never return results.
- 3368501: The binary instant effect toggles, the catalog hide full, hide conflicting, and
  hide unscheduled filters and the four preview display options, are now switches
  rather than checkboxes: activated with Space or Enter, distinct in each state
  without relying on color, and with a reduced motion thumb. The day filter is set
  membership, not a switch, so it keeps its buttons.
- 214d764: Replace the panel's native title hover hints with an accessible tooltip that
  dismisses on Escape, stays open while the pointer is over its content, and matches
  the panel styling. It covers the grid day labels, the truncated course names, and
  the truncated teacher and unscheduled shelf rows. The course drag hint becomes the
  drag surface accessible name rather than a tooltip, because a tooltip on a pointer
  drag surface interferes with the drag. Two title attributes that never showed or
  duplicated visible text are dropped rather than converted.
- c2a9b78: List academic years newest first in the search year selector, since a returning
  student most often plans the newest term. The persisted last search and the route
  aware default still choose the starting year, so only the listing order changes.

## 1.1.1

### Patch Changes

- 00cb4eb: Read a section's additional meetings from the teachtime_str field. A class that
  meets more than once, such as a lecture with a second period on the same day, now
  shows every period on the grid and counts every period in conflict detection
  instead of only the first. Plans saved before this change reconcile to the fuller
  schedule on first open, which can surface a newly true conflict that was hidden
  while the extra period was missing.

## 1.1.0

### Minor Changes

- 4183fc6: Collapse a catalog card once one of its sections is in the plan. The card de-emphasizes to
  a summary of the subject id, name, and credits with a remove and an expand affordance;
  expanding reveals the sections read only for reference, since changing section happens by
  dragging the block on the grid.
- cc4aedd: Add a right click context menu on a placed block in edit mode with two shortcuts, details
  and remove. It replaces the browser menu only on a block, closes on Escape or a click away,
  and stays within the panel. Every keyboard and popover path is unchanged.
- 24008fc: Tighten the catalog card. The section teachers truncate to one line with the full list on
  a hover title, and a remark opens from a compact info affordance rather than crowding the
  row.
- 2d12d43: Replace the last native select in the panel, the credit filter, with the accessible
  combobox in a select only mode, and portal the combobox popup so it positions correctly
  inside the slide over catalog drawer.
- 55880c4: Exam overlap is now a hard block, not a warning. Adding a section whose midterm or final
  overlaps one already in the plan is blocked through the same path as a time conflict, and
  the blocked reason names the exam type and its date range in the Buddhist year both locales
  show. An exam overlap discovered on an existing plan through revalidation or import reads
  danger on the block and is never removed automatically.
- 0201323: Redesign the catalog filter bar. One always visible search field sits beside a filter
  button that carries an active count badge and opens a popover with the day, credit, and
  hide facets; the active facets render as removable chips under the field with a clear all.
- eb03d20: Give the grid blocks a lighter treatment: a soft tint of the subject color under ink text
  with the saturated color as a left bar, replacing the solid fill with white text. The ten
  color palette keeps WCAG AA on the new ink on tint and bar pairs, and the export and
  preview render identically to edit.
- 4183fc6: Make the whole catalog surface a drag source, not only the grip. A section row drags from
  anywhere on its body and a course card drags from its header, the city builder grab feel,
  while a click on an add or remove button still clicks. The grip stays as the visual hint
  and the keyboard commit anchor.

### Patch Changes

- 6633d57: Keep the keyboard focus ring from being clipped. Standardize the focus indicator on an
  inset orange ring for light controls, which paints inside the control so a scrolling rail
  or the catalog drawer can no longer cut it off, and keep an offset outline on the solid
  orange buttons where an inset ring would fail contrast.
- 0f6299d: Refuse non digit input in the subject id field. Keystrokes, pasted content, and IME
  commits are sanitized to digits and clamped to eight, so a leading zero survives and a
  letter never reaches the field.
- 607c151: Use the canonical Thai section term กลุ่มเรียน in the hide full and hide time conflicts
  filter labels, replacing the non canonical ตอน.

## 1.0.0

### Major Changes

- 815afb4: Course Planner for KMITL 1.0.0, the first stable public release. Establishes the
  versioning baseline for the Chrome Web Store and Firefox Add-ons listings. This is an
  independent student tool for the KMITL pre-registration course search and is not
  affiliated with, sponsored by, or endorsed by KMITL.

### Minor Changes

- 97fdb08: Warn when a section's exam time overlaps another entry's. Adding an overlapping section still succeeds; the feedback strip states the clash, the affected blocks carry a warn badge, and the block details list both exam windows. Midterm windows are compared with midterm windows and final with final, and a declared lecture and practice pair never warns against itself.

### Patch Changes

- 616f602: Keep the catalog and the timetable responsive on a large search. The course card and the grid block are memoized and the props they receive are kept stable, so a filter toggle, a plan change, or a drag re-renders only what actually changed rather than every card and block. A filter that drops nothing no longer re-renders any of the hundreds of cards it leaves in place.
- 2552855: Meet WCAG AA contrast on every text and background pair. The warn and success colors are darkened so their text passes on the soft backgrounds, and interactive primary text, the buttons, tabs, and links, uses a darker shade of the brand orange that passes for normal text while the brand orange stays on the accents. A recorded ratio table and a contrast test guard the thresholds.
- 372dd42: Replace the placeholder extension icon with an original mark, a white weekly grid
  with one filled slot on the project orange, rendered from assets/icon.svg to the
  shipped 16 to 128 pixel sizes.
- 46b6696: The plan import rejection now lists each failing field with a reason in the user's language, keeping the field path and dropping the validation library's English. A missing field, a wrong typed field, a value outside an allowed set, and an entry from another term each read as a short localized message.
- 8ee02c5: A long Thai course name no longer overflows its catalog card and a long plan name no longer overflows the poster: the card and the shelf truncate with the full name on a hover, and the poster wraps the name so nothing is hidden in an export. The empty grid hint and the import error listing each gained an icon so they read as designed states.
- 8ee02c5: A render error in the panel now shows a recovery card with a reload action instead of white screening the host page. The boundary wraps the panel body, so the header keeps its close control and the host registration page behind the overlay is untouched.
- c67f1be: Rename the extension to Course Planner for KMITL (KCP) and add an independence
  notice, stating it is an independent student tool that is not affiliated with,
  sponsored by, or endorsed by the university.

This changelog is maintained by Changesets. Each released version records its
user visible changes here.
