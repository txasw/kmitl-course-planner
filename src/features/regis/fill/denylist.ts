// The labels KCP refuses to act on (ADR-0078): every label the tested host build gives a
// clickable element, in Thai and English, as scripts/host-labels.mjs extracts them from the
// host dictionaries, with the commit words the host could add. เพิ่ม and รับทราบ are left
// out because each is checked positively by its own handle. The actuator checks this list
// before every event. A match is by exact equality on the target's own trimmed text,
// never on an ancestor's text, which holds Continue for every control in the add card, and
// never by substring, which would catch a course named "Continuous ...".

const DENIED: ReadonlySet<string> = new Set([
  'Academic Calendar',
  'Add Course to Curriculum / Class Timetable',
  'Back',
  'Cancel',
  'Cancel the queue',
  'Change',
  'Close',
  'Confirm',
  'Confirm and save',
  'Continue',
  'Continuous',
  'Course details',
  "Curriculum on KRESO's Website",
  "Curriculum on OAQ's Website",
  'Download',
  'Download All',
  'Enter the registration process.',
  'Not Passed',
  'OK',
  'Pass',
  'Register',
  'Request Form',
  'Retry',
  'Save',
  'Search',
  'See all',
  'Submit',
  'Timetable',
  'Try again',
  'Use selected date',
  'Verify',
  'View Add / Change / Withdraw Transactions',
  'View Retrospective List',
  'Withdraw',
  'กลับไปดูข้อมูล',
  'ค้นหา',
  'ดาวน์โหลด',
  'ดาวน์โหลดทั้งหมด',
  'ดำเนินการต่อ',
  'ดูทั้งหมด',
  'ดูประวัติการลงทะเบียน / เพิ่ม / เปลี่ยน / ถอน',
  'ดูรายการแถวคอยย้อนหลัง',
  'ตกลง',
  'ตรวจ',
  'ตารางเรียน-สอบ',
  'ถอน',
  'บันทึก',
  'ปฏิทินการศึกษา',
  'ปิด',
  'ผ่าน',
  'ยกเลิก',
  'ยกเลิกคิว',
  'ยืนยัน',
  'ยืนยันและบันทึก',
  'ยื่นคำขอ',
  'ย้อนกลับ',
  'รายละเอียดรายวิชา',
  'ลงทะเบียน',
  'ลองอีกครั้ง',
  'ส่ง',
  'ส่งผล',
  'หลักสูตรหน้าเว็บ KRESO',
  'หลักสูตรหน้าเว็บ OAQ',
  'เข้าสู่ขั้นตอนการลงทะเบียน',
  'เปลี่ยน',
  'เพิ่มวิชาเรียนไปยังตารางสอนหลักสูตร / ชั้นปี',
  'เลือกวันที่นี้',
  'ไม่ผ่าน',
]);

/** Whether a host element's own text is a label KCP never acts on. */
export function isDeniedLabel(text: string): boolean {
  return DENIED.has(text.replace(/\s+/g, ' ').trim());
}

// Containers KCP never acts inside: any dialog, a form, and the host's commit and warning
// colours. A select menu and the grade dialog are allowed only to the handle that names
// them, and only that element itself is exempt, so a menu nested in a dialog still fails.
const FORBIDDEN_CONTAINER =
  '.v-dialog, .v-dialog__content, [role="dialog"], form, .deep-orange, .warning, .v-menu__content';

/** Whether an element or an ancestor is a container KCP never acts inside. */
export function insideForbidden(
  element: Element,
  allowed: readonly Element[],
): boolean {
  if (element.getAttribute('type') === 'submit') return true;
  for (
    let node: Element | null = element;
    node !== null;
    node = node.parentElement
  ) {
    if (!allowed.includes(node) && node.matches(FORBIDDEN_CONTAINER)) {
      return true;
    }
  }
  return false;
}
