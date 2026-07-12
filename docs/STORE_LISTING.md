# Store listing and submission runbook

This document is the submission runbook for the first public release. It holds the
listing copy in Thai and English, the single purpose statement, the permission
justifications, the data disclosure answers, the screenshot plan, the compliance
sweep results, and the exact dashboard steps for a manual first submission to each
store. Publishing stays a manual dashboard action for the first listed release.

## Product identity

- Display name: Course Planner for KMITL (short form KCP).
- This is an independent student tool. It is not affiliated with, sponsored by, or
  endorsed by King Mongkut's Institute of Technology Ladkrabang (KMITL).
- Category: Chrome Web Store, Education (Productivity is an acceptable alternative);
  Firefox Add-ons, Other.
- Primary language: Thai. Secondary language: English.
- Privacy policy URL: https://github.com/txasw/kmitl-course-planner/blob/main/docs/PRIVACY.md
- Homepage and support URL: https://github.com/txasw/kmitl-course-planner

## Descriptions

### English, short summary

A weekly timetable planner for KMITL course registration. Search offerings, remove
the duplicated rows, and plan your sections on a drag and drop grid with conflict
detection.

### English, full description

Course Planner for KMITL (KCP) is an independent tool built by a student. It is not
affiliated with, sponsored by, endorsed by, or officially connected to King Mongkut's
Institute of Technology Ladkrabang (KMITL). It reads only the public course data the
registration site already exposes.

The KMITL registration site lists course offerings as a dense table that repeats the
same section across curriculum groupings, which makes it hard to plan by hand. This
extension reads that same public data, removes the duplicated rows, and presents it as
an interactive weekly timetable.

What it does:

- Search the course offerings by curriculum and class year, by subject id, or by
  subject category, the same three ways the registration site offers.
- Build a weekly plan by adding sections to a drag and drop grid.
- See time conflicts before you commit a section, with clear reasons and suggested
  alternatives.
- Keep several named plans per term, saved on your device and restored on reload.
- Revalidate a plan against the live data when you open it, so a changed time or a
  removed section is flagged rather than silently wrong.
- Export a plan as an image to share, or copy it as plain text for chat apps.

Privacy: all data stays in your browser. There is no account, no backend, and no
analytics or telemetry of any kind. The extension is read only with respect to the
registration site; it never submits forms and never performs registration actions.

### Thai, short summary

โปรแกรมช่วยจัดตารางเรียนรายสัปดาห์สำหรับการลงทะเบียนเรียนของ สจล. ค้นหารายวิชา รวมรายการที่ซ้ำ
และวางแผนกลุ่มเรียนบนตารางแบบลากวาง พร้อมตรวจเวลาที่ชนกัน

### Thai, full description

Course Planner for KMITL (KCP) เป็นเครื่องมือที่พัฒนาโดยนักศึกษาอย่างอิสระ ไม่มีความเกี่ยวข้อง
ไม่ได้รับการสนับสนุน และไม่ได้รับการรับรองจากสถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง (สจล.)
โปรแกรมอ่านเฉพาะข้อมูลรายวิชาที่เปิดเผยเป็นสาธารณะบนหน้าลงทะเบียนอยู่แล้วเท่านั้น

หน้าลงทะเบียนของ สจล. แสดงรายวิชาที่เปิดสอนเป็นตารางที่มีรายการเดียวกันซ้ำกันในหลายกลุ่มหลักสูตร
ทำให้วางแผนด้วยตนเองได้ยาก ส่วนขยายนี้อ่านข้อมูลสาธารณะชุดเดียวกัน รวมรายการที่ซ้ำ และแสดงผลเป็น
ตารางเรียนรายสัปดาห์ที่ใช้งานแบบโต้ตอบได้

ความสามารถ:

- ค้นหารายวิชาตามหลักสูตรและชั้นปี ตามรหัสวิชา หรือตามหมวดวิชา ตรงกับสามวิธีที่หน้าลงทะเบียนมีให้
- จัดตารางรายสัปดาห์โดยเพิ่มกลุ่มเรียนลงในตารางแบบลากวาง
- เห็นเวลาที่ชนกันก่อนเพิ่มกลุ่มเรียน พร้อมเหตุผลและตัวเลือกอื่นที่แนะนำ
- เก็บตารางที่ตั้งชื่อได้หลายตารางต่อหนึ่งภาคการศึกษา บันทึกไว้บนเครื่องและกลับมาแสดงเมื่อโหลดหน้าใหม่
- ตรวจสอบตารางกับข้อมูลจริงเมื่อเปิด เพื่อแจ้งเตือนเมื่อเวลาถูกเปลี่ยนหรือกลุ่มเรียนถูกถอนออก
- ส่งออกตารางเป็นรูปภาพเพื่อแชร์ หรือคัดลอกเป็นข้อความสำหรับแอปแชท

ความเป็นส่วนตัว: ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์ของคุณ ไม่มีบัญชีผู้ใช้ ไม่มีเซิร์ฟเวอร์ และไม่มีการเก็บสถิติ
หรือการติดตามใด ๆ ส่วนขยายนี้อ่านข้อมูลอย่างเดียวจากหน้าลงทะเบียน ไม่กรอกหรือส่งแบบฟอร์ม และไม่ทำ
รายการลงทะเบียนแทนผู้ใช้

## Chrome Web Store, single purpose statement

Course Planner for KMITL is a visual weekly timetable planner for KMITL students. It
reads the public course offering data the registration site already exposes, removes
duplicate rows, and presents it as an interactive weekly grid with conflict detection,
saved plans, and image export. It does not register for courses and does not modify
the registration site.

## Permission justifications

These are written for the Chrome Web Store privacy tab and reused for the AMO notes to
reviewers. Each states what the permission is for and that data stays on the device.

- storage: Save the student's timetable plans and cache the public reference data
  (faculty, department, curriculum, and subject lists) on the device, so the interface
  loads quickly and plans survive page reloads. No data leaves the browser.
- Host access to https://regis.reg.kmitl.ac.th/*: Mount the planner interface on the
  registration site and read the public teach table course data the site itself loads.
  Read only; the extension never submits forms and never performs registration actions.
- Host access to https://api.reg.kmitl.ac.th/*: Read the public faculty, department,
  curriculum, and subject owner reference lists used to build the search filters. Read
  only.
- Remote code: No. The extension executes no remotely hosted code.

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
with the function (Course Planner for KMITL, not KMITL Course Planner), the independence
notice appears in the listing, the README, and the privacy statement, and the icon is an
original mark, never the university seal or logo. If a reviewer still objects to the
institution appearing in the name, the fallback is the bare KCP form (ADR 0033 records
the identity decision path).

## Compliance sweep results

Reviewed against current store policies on 2026-07-11.

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
https://regis.reg.kmitl.ac.th/#/teach_table_selector before submission.

Recapture all five screenshots after the v1.1 UX refinement train ships. The filter bar,
the catalog cards, and the grid blocks changed in it, so screenshots 2 through 5 no longer
match the shipped interface.

- Store icon: 128 by 128 pixels. Reuse `public/icon/128.png`.
- Screenshots: 1280 by 800 pixels, at least one and up to five. Full bleed, square
  corners, no padding.
- Small promotional tile (optional, improves placement): 440 by 280 pixels.
- Marquee promotional tile (optional): 1400 by 560 pixels.

Screenshot shot list, each captioned:

1. The launcher on the registration site. Caption: Open the planner from any page of the
   registration site.
2. Search and the deduplicated course list. Caption: Search offerings and see unique
   sections, with duplicate rows merged.
3. The weekly grid with a placed schedule. Caption: Build your week on a drag and drop
   timetable.
4. Conflict feedback during a blocked placement. Caption: See time conflicts before you
   commit, with suggested alternatives.
5. Preview mode with the export toolbar. Caption: Export your plan as an image or copy it
   as text.

## Firefox source package

The sources zip that AMO requires is produced by `pnpm zip:firefox`, which writes both
`.output/kmitl-course-planner-<version>-firefox.zip` and
`.output/kmitl-course-planner-<version>-sources.zip`. The sources zip excludes private
working material by construction (see the zip config in `wxt.config.ts`) and contains the
lockfile and everything needed to rebuild. The build instructions the reviewer follows
are the Building from source section of the README.

## Chrome Web Store submission steps (manual, first release)

1. Sign in to the Chrome Web Store developer dashboard with the developer account
   (a one time registration fee applies to the account, not to each item).
2. Choose Add new item and upload the Chrome zip from the GitHub release,
   `kmitl-course-planner-<version>-chrome.zip`.
3. On the Store listing tab, set the display name Course Planner for KMITL, paste the
   English and Thai descriptions, choose the Education category, set the language, and
   upload the store icon and the screenshots.
4. On the Privacy tab, paste the single purpose statement, add the permission
   justification for storage and for each host permission, answer No to remote code,
   leave every data type unchecked, affirm the three limited use certifications, and set
   the privacy policy URL.
5. Submit for review. Keep the item in the account until the review completes.

## Firefox Add-ons submission steps (manual, first release)

1. Sign in to the Firefox Add-on Developer Hub with the AMO account.
2. Choose Submit a New Add-on and upload the Firefox zip from the GitHub release,
   `kmitl-course-planner-<version>-firefox.zip`. The add-on id is
   `kmitl-course-planner@txasw.github.io`.
3. When asked whether the add-on needs its source code submitted, choose yes and upload
   the sources zip, `kmitl-course-planner-<version>-sources.zip`. Point the build notes
   to the README Building from source section.
4. Complete the listing with the display name, the English and Thai summaries and
   descriptions, the Other category, the screenshots, and the privacy policy URL.
5. Submit for review.

## Publishing credentials

The automated publish jobs stay gated behind the `chrome-web-store` and `amo` GitHub
environments, each with a required reviewer. They are not used for the first release,
which is submitted manually through the dashboards above. Before enabling automated
submission for a later release, add these environment secrets.

Chrome Web Store, from the Chrome Web Store API setup for an OAuth client:

- CHROME_EXTENSION_ID
- CHROME_CLIENT_ID
- CHROME_CLIENT_SECRET
- CHROME_REFRESH_TOKEN

Firefox AMO, from the AMO API key page, along with the gecko add-on id recorded in the
manifest:

- FIREFOX_JWT_ISSUER
- FIREFOX_JWT_SECRET

## Account credentials to have ready

- A Chrome Web Store developer account (the one time registration fee is paid once per
  account).
- A Firefox Add-ons (AMO) developer account.
- The five listing images described above, captured at the stated dimensions.
