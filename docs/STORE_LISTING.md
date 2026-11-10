# Store listing and update runbook

This document is the runbook for updating the published store listings. It holds the
listing copy in Thai and English, the fields to paste into each store dashboard, the
single purpose statement, the permission justifications, the data disclosure answers,
the screenshot plan, the compliance sweep results, and the steps for uploading a new
version to each store.

## Product identity

- Display name: KCP: Course Planner for KMITL (ADR-0065).
- Chrome Web Store listing:
  https://chromewebstore.google.com/detail/bkjijmajieoojchaknjdpbkaomnofnef. Chrome,
  Edge, Brave, Opera, and other Chromium browsers install from it.
- Firefox Add-ons listing: https://addons.mozilla.org/firefox/addon/kcp/.
  The listing is live. Check the version shown on the listing after each upload.
- Project site: https://kcp.cecs.sh/
- This is an independent student tool. It is not affiliated with, sponsored by, or
  endorsed by King Mongkut's Institute of Technology Ladkrabang (KMITL).
- Category: Chrome Web Store, Education (Productivity is an acceptable alternative);
  Firefox Add-ons, Other.
- Primary language: Thai. Secondary language: English.
- Privacy policy URL: https://github.com/txasw/kmitl-course-planner/blob/main/docs/PRIVACY.md
- Support URL: https://github.com/txasw/kmitl-course-planner/issues
- Source repository: https://github.com/txasw/kmitl-course-planner

## Descriptions

Every full description opens with the independence notice. The Chrome Web Store summary
comes from the manifest and is capped at 132 characters, which leaves no room for the
notice, so the full description carries it first.

### English, short summary

This is the manifest `description`, which the Chrome Web Store shows as the summary:

KCP is a timetable planner for KMITL students. Search course offerings and plan sections
on a weekly grid with conflict checks.

### English, Firefox Add-ons summary

KCP is a KMITL course planner for pre registration. Search the course offerings, merge
the duplicate rows, and plan your sections on a weekly grid with conflict checks. An
independent student tool, not affiliated with KMITL.

### English, full description

KCP: Course Planner for KMITL is an independent tool built by a student. It is not
affiliated with, sponsored by, endorsed by, or officially connected to King Mongkut's
Institute of Technology Ladkrabang (KMITL). It reads only the public course data the
registration site already exposes.

KCP is a KMITL course planner for pre registration. The KMITL registration site lists
course offerings as a dense table that repeats the same section across curriculum
groupings, which makes it hard to plan by hand. KCP reads that same public data, removes
the duplicated rows, and presents it as an interactive weekly timetable.

What it does:

- Search the course offerings by curriculum and class year, by subject id, or by
  subject category, the same three ways the registration site offers.
- Scan the results as compact course cards, open the sections you need, and compare the
  sections of a course in one table.
- Build a weekly plan by dragging sections onto the timetable or with the add buttons.
- See time and exam conflicts before you commit a section, with clear reasons and
  suggested alternatives.
- Get up to three conflict free timetable suggestions from a curriculum search.
- Keep several named plans per term, saved on your device and restored on reload, and
  review them as a timetable, a list of selected courses, or an exam summary.
- Revalidate a plan against the live data when you open it, so a changed time or a
  removed section is flagged rather than silently wrong.
- Export a plan as an image at a fixed size for sharing, a phone or tablet wallpaper, or
  print, or copy it as plain text for chat apps, with an optional exam schedule.
- Open the planner from the Planner button on the registration site, from the toolbar
  icon, or with Alt+Shift+P (Option+Shift+P on macOS).

Privacy: all data stays in your browser. There is no account, no backend, and no
analytics or telemetry of any kind. The extension is read only with respect to the
registration site; it never submits forms and never performs registration actions.

### Thai, short summary

KCP ส่วนขยายสำหรับจัดตารางเรียน สจล. ค้นหารายวิชาที่เปิดสอน รวมรายการที่ซ้ำ และวางแผนกลุ่มเรียน
บนตารางรายสัปดาห์พร้อมตรวจเวลาที่ชนกัน เป็นเครื่องมืออิสระของนักศึกษา ไม่เกี่ยวข้องกับ สจล.

### Thai, full description

KCP: Course Planner for KMITL เป็นเครื่องมือที่พัฒนาโดยนักศึกษาอย่างอิสระ ไม่มีความเกี่ยวข้อง
ไม่ได้รับการสนับสนุน และไม่ได้รับการรับรองจากสถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง (สจล.)
โปรแกรมอ่านเฉพาะข้อมูลรายวิชาที่เปิดเผยเป็นสาธารณะบนหน้าลงทะเบียนอยู่แล้วเท่านั้น

KCP ช่วยจัดตารางเรียน สจล. และวางแผนลงทะเบียนเรียน KMITL ล่วงหน้า หน้าลงทะเบียนของ สจล.
แสดงรายวิชาที่เปิดสอนเป็นตารางที่มีรายการเดียวกันซ้ำกันในหลายกลุ่มหลักสูตร ทำให้วางแผนด้วยตนเองได้ยาก
KCP อ่านข้อมูลสาธารณะชุดเดียวกัน รวมรายการที่ซ้ำ และแสดงผลเป็นตารางเรียนรายสัปดาห์ที่ใช้งานแบบโต้ตอบได้

ความสามารถ:

- ค้นหารายวิชาตามหลักสูตรและชั้นปี ตามรหัสวิชา หรือตามหมวดวิชา ตรงกับสามวิธีที่หน้าลงทะเบียนมีให้
- ดูผลการค้นหาเป็นการ์ดรายวิชาแบบย่อ เปิดดูเฉพาะกลุ่มเรียนที่ต้องการ และเปรียบเทียบกลุ่มเรียนของวิชาเดียวกันในตารางเดียว
- จัดตารางรายสัปดาห์โดยลากกลุ่มเรียนลงในตาราง หรือใช้ปุ่มเพิ่ม
- เห็นเวลาเรียนและเวลาสอบที่ชนกันก่อนเพิ่มกลุ่มเรียน พร้อมเหตุผลและตัวเลือกอื่นที่แนะนำ
- รับตารางที่แนะนำซึ่งไม่มีเวลาชนกันได้สูงสุดสามแบบจากการค้นหาตามหลักสูตร
- เก็บตารางที่ตั้งชื่อได้หลายตารางต่อหนึ่งภาคการศึกษา บันทึกไว้บนเครื่องและกลับมาแสดงเมื่อโหลดหน้าใหม่
  และดูได้ทั้งแบบตารางเรียน รายการวิชาที่เลือก และสรุปตารางสอบ
- ตรวจสอบตารางกับข้อมูลจริงเมื่อเปิด เพื่อแจ้งเตือนเมื่อเวลาถูกเปลี่ยนหรือกลุ่มเรียนถูกถอนออก
- ส่งออกตารางเป็นรูปภาพตามขนาดที่กำหนดสำหรับแชร์ ภาพพื้นหลังโทรศัพท์หรือแท็บเล็ต หรือพิมพ์
  หรือคัดลอกเป็นข้อความสำหรับแอปแชท และเลือกแสดงตารางสอบได้
- เปิดตัววางแผนได้จากปุ่ม Planner บนหน้าลงทะเบียน จากไอคอนบนแถบเครื่องมือ หรือกด Alt+Shift+P
  (Option+Shift+P บน macOS)

ความเป็นส่วนตัว: ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์ของคุณ ไม่มีบัญชีผู้ใช้ ไม่มีเซิร์ฟเวอร์ และไม่มีการเก็บสถิติ
หรือการติดตามใด ๆ ส่วนขยายนี้อ่านข้อมูลอย่างเดียวจากหน้าลงทะเบียน ไม่กรอกหรือส่งแบบฟอร์ม และไม่ทำ
รายการลงทะเบียนแทนผู้ใช้

## Search and discovery

Students look for the tool with phrases such as KCP KMITL, KMITL course planner,
จัดตารางเรียน สจล., and วางแผนลงทะเบียนเรียน KMITL. The title carries KCP and KMITL
together, and the descriptions above work the other phrases into plain sentences. Do not
add keyword lists, repeated terms, or other brand names: both stores treat keyword
stuffing as spam.

Only two fields come from the package. The manifest `name` sets the item title, KCP:
Course Planner for KMITL, and the manifest `description` sets the Chrome Web Store
summary. Both update when a new package is uploaded. Every other field is set by hand.

Chrome Web Store developer dashboard, Store listing tab:

- Description: paste the English full description, a blank line, and then the Thai full
  description. The package declares no locale folders, so the listing has one
  description field.
- Category: Education.
- Homepage URL: https://kcp.cecs.sh/
- Support URL: https://github.com/txasw/kmitl-course-planner/issues
- Screenshots: the five shots below, in order.

Firefox Add-on Developer Hub, Edit Product Page:

- Name: KCP: Course Planner for KMITL. Check it after each upload, since the hub keeps
  its own copy of the listing name.
- Summary: the English Firefox Add-ons summary, and the Thai short summary in the Thai
  locale.
- Description: the English full description, and the Thai full description in the Thai
  locale.
- Homepage: https://kcp.cecs.sh/
- Support site: https://github.com/txasw/kmitl-course-planner/issues

The README heading and the project site lead with the same name, so a web search for
KCP KMITL finds the repository, the project site, and both listings under one title.

## Chrome Web Store, single purpose statement

KCP: Course Planner for KMITL is a visual weekly timetable planner for KMITL students.
It reads the public course offering data the registration site already exposes, removes
duplicate rows, and presents it as an interactive weekly grid with conflict detection,
saved plans, and image export. It does not register for courses and does not modify the
registration site.

## Permission justifications

These are written for the Chrome Web Store privacy tab and reused for the AMO notes to
reviewers. Each states what the permission is for and that data stays on the device.

- storage: Save the student's timetable plans, interface preferences, the last search on
  each search tab, and the install and onboarding records on the device. Cache the
  public reference data (faculty, department, curriculum, and subject lists, and the
  current registration term) for a day and recent course search results for ten minutes, so the interface loads quickly and
  plans survive page reloads. Session storage holds a short lived record of a tab the
  extension opened, so that tab can open the planner. No data leaves the browser.
- Host access to https://regis.reg.kmitl.ac.th/*: Mount the planner interface on the
  registration site, read the public teach table course data the site itself loads, and
  read the current registration term that sets the default term of the search form.
  Read only; the extension never submits forms and never performs registration actions.
- Host access to https://api.reg.kmitl.ac.th/*: Read the public faculty, department,
  curriculum, and subject owner reference lists used to build the search filters. Read
  only.
- Remote code: No. The extension executes no remotely hosted code.

First run note for reviewers. On first install the extension opens one tab at
https://regis.reg.kmitl.ac.th/#/teach_table_selector, the registration site's own
course search page, and shows a one time welcome there that explains the planner. It
opens that tab only when both host permissions are granted and never on an update. The
tab is opened with `tabs.create`, which needs no `tabs` permission.

Toolbar note for reviewers. The toolbar icon and its shortcut, Alt+Shift+P, open the
planner only when the user clicks or presses them. On a registration page the panel
opens in that tab through `tabs.sendMessage`. From any other tab the extension brings
forward the search page it opened moments before with `tabs.update` and
`windows.update`, or opens the search page with `tabs.create`. None of these calls needs
the `tabs` permission. On Firefox, where host access can be withheld, each click asks for
the two KMITL origins through `permissions.request`, and Firefox shows a prompt only
while they are not granted.

## Data disclosure

The extension collects none of the data categories the Chrome Web Store privacy tab
lists. On the privacy tab, leave every data type unchecked:

- Personally identifiable information: not collected.
- Health information: not collected.
- Financial and payment information: not collected.
- Authentication information: not collected.
- Personal communications: not collected.
- Location: not collected.
- Web history: not collected.
- User activity: not collected.
- Website content: not collected.

Affirm all three limited use certifications:

- I do not sell or transfer user data to third parties, outside of the approved use
  cases.
- I do not use or transfer user data for purposes that are unrelated to my item's
  single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending
  purposes.

For Firefox, the manifest declares no data collection through
`browser_specific_settings.gecko.data_collection_permissions` set to `{ required:
["none"] }`, which is the honest declaration and clears the linter's data collection
notice.

## Trademark and impersonation

Using the institution name is a nominative reference to the site the tool serves, not a
claim of affiliation. The mitigations are recorded and in place: the display name leads
with the product's own short form and its function (KCP: Course Planner for KMITL, not
KMITL Course Planner), the independence notice appears in every listing description, the
README, and the privacy statement, and the icon is an original mark, never the university
seal or logo. If a reviewer still objects to the institution appearing in the name, the
fallback is the bare KCP form (ADR-0032 records the identity decision path, and ADR-0065
the KCP prefix).

## Compliance sweep results

Reviewed against current store policies on 2026-07-11, for the first release.

Chrome Web Store:

- Single purpose is stated above and the permissions are the minimum for it.
- The privacy policy URL is public and reachable.
- Data disclosure declares no collection, and the three limited use certifications hold.
- The 2026 data disclosure enforcement applies to all extensions; since nothing is
  collected, every category is declared not collected and the privacy policy is public.

Firefox Add-ons:

- addons-linter, run through `web-ext lint` against the built firefox output, reports 0
  errors, 5 warnings, 0 notices.
- The 5 warnings are `DANGEROUS_EVAL` (2) and `UNSAFE_VAR_ASSIGNMENT` (3), all in the
  bundled output files (`background.js`, `content-scripts/regis.js`). They originate in
  third party library code that Vite bundles, not in the project source, which forbids
  `eval`, the `Function` constructor, and `innerHTML` through ESLint. They are warnings,
  not errors, and do not block review; the source package lets a reviewer confirm their
  origin.
- The missing data collection permissions warning was resolved by declaring none.
- Source code submission is required because the build is bundled and minified. The
  source package is produced by `pnpm zip:firefox` as the sources zip described below.

To reproduce the lint: `pnpm build -b firefox` then
`pnpm dlx web-ext lint --source-dir .output/firefox-mv3 --self-hosted`.

## Images and screenshots

Assets to capture on the live site at
https://regis.reg.kmitl.ac.th/#/teach_table_selector with the built production
extension.

Capture all five screenshots on v1.4.0, the build the next update ships. The v1.4.0
layout train changed most of the captured surfaces, so earlier screenshots no longer
match: the launcher is an orange pill with the Planner label, the search form sits at the
top of the course column with no separate search column, course cards start collapsed,
each section row carries one status badge, timetable blocks lead with the subject name
and show the building and room on the second line with the time at the foot, a stats bar
under the plan replaces the footer and the revalidation banner, and plan view tabs sit
above the timetable.

- Store icon: 128 by 128 pixels. Reuse `public/icon/128.png`.
- Screenshots: 1280 by 800 pixels, at least one and up to five. Full bleed, square
  corners, no padding.
- Small promotional tile (optional, improves placement): 440 by 280 pixels.
- Marquee promotional tile (optional): 1400 by 560 pixels.

Screenshot shot list, each captioned:

1. The Planner pill launcher on the registration site, with the entry prompt beside it.
   Caption: Open the planner from the registration site, the toolbar icon, or
   Alt+Shift+P.
2. The course column with the search form on top and the deduplicated results, one card
   open to show its section rows and their status badges. Caption: Search offerings and
   see unique sections, with duplicate rows merged.
3. The weekly grid with a placed schedule, showing blocks that lead with the subject name
   and show the building and room as the second line, the plan view tabs above it, and
   the stats bar below. Caption: Build your week on a drag and drop timetable.
4. Conflict feedback during a blocked placement. Caption: See time and exam conflicts
   before you commit, with suggested alternatives.
5. Preview mode with the export gallery: the selected poster centred, the neighbouring
   templates peeking at both edges, and the dot picker with the size caption below. Caption:
   Preview and pick an export at a fixed size, a phone or tablet wallpaper in either
   orientation, share, or print, or copy your plan as text.

## Firefox source package

The sources zip that AMO requires is produced by `pnpm zip:firefox`, which writes both
`.output/kmitl-course-planner-<version>-firefox.zip` and
`.output/kmitl-course-planner-<version>-sources.zip`. The sources zip excludes private
working material by construction (see the zip config in `wxt.config.ts`) and contains the
lockfile and everything needed to rebuild. The build instructions the reviewer follows
are the Building from source section of the README.

## Chrome Web Store update steps

1. Sign in to the Chrome Web Store developer dashboard with the developer account.
2. Open the existing item, id `bkjijmajieoojchaknjdpbkaomnofnef`. On the Package tab,
   choose Upload new package and upload the Chrome zip from the GitHub release,
   `kmitl-course-planner-<version>-chrome.zip`. The `publish-chrome` job in the release
   workflow can upload the same zip instead, after its environment approval (see
   Publishing credentials).
3. On the Store listing tab, confirm the name and summary read from the new package,
   and update the fields listed in Search and discovery when the listing copy or the
   screenshots changed.
4. On the Privacy tab, update the permission justifications when they changed, keep the
   single purpose statement, answer No to remote code, leave every data type unchecked,
   and keep the privacy policy URL.
5. Submit for review. The listed version stays live until the review completes.

## Firefox Add-ons update steps

1. Sign in to the Firefox Add-on Developer Hub with the AMO account and open the
   existing add-on, id `kmitl-course-planner@txasw.github.io`.
2. Choose Upload New Version and upload the Firefox zip from the GitHub release,
   `kmitl-course-planner-<version>-firefox.zip`. The `publish-firefox` job in the release
   workflow can submit the same zip and the sources zip instead, after its environment
   approval.
3. When asked whether the version needs its source code submitted, choose yes and upload
   the sources zip, `kmitl-course-planner-<version>-sources.zip`. Point the build notes
   to the README Building from source section, and paste the reviewer notes from
   Permission justifications.
4. On Edit Product Page, update the fields listed in Search and discovery when the
   listing copy or the screenshots changed.
5. Submit the version for review.

## Publishing credentials

The automated publish jobs in `.github/workflows/release.yml` are gated behind the
`chrome-web-store` and `amo` GitHub environments, each with a required reviewer, so no
upload runs without an explicit approval. The environment secrets are configured.

Chrome Web Store, on the `chrome-web-store` environment. The job uses Chrome Web Store
API v2 with a service account, because Google retired the v1.1 API and its OAuth refresh
token:

- CHROME_EXTENSION_ID: the item id, `bkjijmajieoojchaknjdpbkaomnofnef`.
- CHROME_PUBLISHER_ID: shown in the Developer Dashboard under Publisher, Settings.
- CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: the `client_email` field of the service account
  JSON key.
- CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: the `private_key` field of the same key. The job
  accepts it with real line breaks or with the escaped `
` sequences of the JSON file.

To create the service account, following
https://developer.chrome.com/docs/webstore/service-accounts:

1. In the Google Cloud console, create or select a project and enable the Chrome Web
   Store API.
2. Create a service account in IAM and admin, Service accounts. It needs no role.
3. On the service account, create a key of type JSON and keep the downloaded file
   private. Delete it once the two secrets are saved.
4. In the Chrome Web Store Developer Dashboard, open Account and add the service account
   email. A publisher can hold one service account.
5. Save the four secrets on the `chrome-web-store` environment, then delete the retired
   CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, and CHROME_REFRESH_TOKEN secrets.

The upload fails when a version is already waiting for review, rather than cancel that
review, so publish the next version only after the previous one clears review.

Firefox AMO, on the `amo` environment, from the AMO API key page and the gecko add-on id
recorded in the manifest:

- FIREFOX_EXTENSION_ID
- FIREFOX_JWT_ISSUER
- FIREFOX_JWT_SECRET

## Accounts

- The Chrome Web Store developer account that owns the item.
- The Firefox Add-ons (AMO) developer account that owns the add-on.
- The five listing images described above, captured at the stated dimensions, when a
  release changes the captured surfaces.
