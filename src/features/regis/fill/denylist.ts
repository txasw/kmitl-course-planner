// The labels KCP refuses to act on (ADR-0078): every label the tested host build gives a
// clickable element in its registration dictionaries, in Thai and English, as
// scripts/host-labels.mjs extracts them, with the commit words the host could add.
// เพิ่ม and รับทราบ are left out because each is checked positively by its own handle,
// and the actuator checks this list before every event. A match is by exact equality on
// the target's own trimmed text, never on an ancestor's text, which holds Continue for
// every control in the add card, and never by substring, which would catch a course
// named "Continuous ...". The Thai label of the flow chart's enter button is left out: it
// shows only before the add card exists. The retry button of the registration periods,
// which app.a1e43722 shows above the panel when its period check fails, is listed though
// no resolver can reach it, so the list stays the whole set the script prints.

const DENIED: ReadonlySet<string> = new Set([
  'Academic Calendar',
  'Back',
  'Cancel',
  'Cancel the queue',
  'Change',
  'Close',
  'Confirm',
  'Continue',
  'Continuous',
  "Curriculum on KRESO's Website",
  "Curriculum on OAQ's Website",
  'Enter the registration process.',
  'OK',
  'Register',
  'Save',
  'Submit',
  'Timetable',
  'Try again',
  'View Add / Change / Withdraw Transactions',
  'View Retrospective List',
  'Withdraw',
  'กลับไปดูข้อมูล',
  'ดำเนินการต่อ',
  'ดูประวัติการลงทะเบียน / เพิ่ม / เปลี่ยน / ถอน',
  'ดูรายการแถวคอยย้อนหลัง',
  'ตกลง',
  'ตารางเรียน-สอบ',
  'ถอน',
  'บันทึก',
  'ปฏิทินการศึกษา',
  'ปิด',
  'ยกเลิก',
  'ยกเลิกคิว',
  'ยืนยัน',
  'ย้อนกลับ',
  'ลงทะเบียน',
  'ลองอีกครั้ง',
  'ส่ง',
  'หลักสูตรหน้าเว็บ KRESO',
  'หลักสูตรหน้าเว็บ OAQ',
  'เปลี่ยน',
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

// A dispatched click runs the activation behaviour of the nearest element on its path
// that has one, and reaches every click listener above the target: a label clicks the
// control it names, a link navigates, a summary toggles, and a host button or button role
// runs its own handler. None of these may sit above a target, whatever its colour.
const ACTIVATING_ANCESTOR =
  'a[href], area[href], button, label, summary, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="tab"], [onclick]';

/**
 * Whether a target would act beyond itself when clicked or given input: a link, a label,
 * or a button or field that a form owns, which a button does by its default submit type
 * or by a form attribute naming a form anywhere on the page.
 */
function activatesBeyond(element: Element): boolean {
  if (element.hasAttribute('href') || element.matches('label, summary')) {
    return true;
  }
  if (element instanceof HTMLButtonElement) {
    return (
      element.type !== 'button' ||
      element.form !== null ||
      element.hasAttribute('formaction') ||
      element.hasAttribute('popovertarget') ||
      element.hasAttribute('commandfor')
    );
  }
  if (element instanceof HTMLInputElement) {
    return element.type !== 'text' || element.form !== null;
  }
  return element.getAttribute('type') === 'submit';
}

/** Whether an element or an ancestor is a container or a control KCP never acts inside. */
export function insideForbidden(
  element: Element,
  allowed: readonly Element[],
): boolean {
  if (activatesBeyond(element)) return true;
  for (
    let node: Element | null = element;
    node !== null;
    node = node.parentElement
  ) {
    if (!allowed.includes(node) && node.matches(FORBIDDEN_CONTAINER)) {
      return true;
    }
    if (node !== element && node.matches(ACTIVATING_ANCESTOR)) return true;
  }
  return false;
}
