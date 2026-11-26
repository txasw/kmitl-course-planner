// What the read only observer expects of the host's pre registration page (ADR-0077), in
// one place: the host builds KCP was tested against, the structural anchors and the fixed
// labels the host prints from its own dictionaries in both of its languages, the row
// colours, and the grammar of the few texts the observer reads. A label here is the host's
// own interface text, never a server message, so matching it reveals nothing about the
// student. Any mismatch turns the observer off and leaves the manual marks.

/**
 * The host script names the observer was tested against, both required (owner 20A).
 * app.020e81ed, deployed 2026-11-25 at 04:09 GMT, was compared with app.454d9e95 with its
 * minified names normalised: the four pre registration render functions (the add subject
 * card, the stepper, the panel, and the complete step) are the same, every host label
 * here appears as often, and so does every reference to a registration write endpoint.
 * The redeploy changed staff and payment pages only, and the vendor bundle is the same.
 *
 * app.a1e43722, deployed 2026-11-25 at 09:53 GMT beside the same vendor bundle, was
 * compared with both: the add subject card, the stepper, the panel, the complete step,
 * the consent and flow chart steps, the grade not announced dialog with its one
 * acknowledgement, every host label here, and every reference to a registration write
 * endpoint are the same, and so is the surrogate key. Its PreRegistration route changed
 * around the panel: a RegistrationHeader with an h1 title and a subtitle h2 of the semester
 * over the year, a RegistrationPeriods section above the panel whose countdown ticks every
 * second, and a period check that polls check-registration-datetime every 60 s, on a
 * window focus, and on a visibility change, and can unmount the panel or mount it again
 * with no navigation. The observer bounds its readings and reads the panel leaving
 * (watchPage.ts), and the fill tripwire leaves that check out of its count by its exact
 * function name, so a check that lands in a fill run does not stop it (tripwire.ts).
 * scripts/host-labels.mjs run on it prints the labels of app.020e81ed and one more pair,
 * Try again and ลองอีกครั้ง, the retry button of the periods section when its check
 * fails, which the fill denylist now holds too.
 *
 * app.ba450963, deployed 2026-11-26 at 03:21 GMT beside the same vendor bundle, was
 * compared with app.a1e43722 with its minified names normalised: the PreRegistration route
 * with its header, periods and period check, the panel, the add subject card, the stepper,
 * the complete, consent and flow chart steps, every host label printed by
 * scripts/host-labels.mjs, and every reference to a registration write endpoint are the
 * same. The redeploy renamed a staff tool and added a staff student lookup and a staff
 * department filter only.
 *
 * Beside this list, the host check (ADR-0079) treats as tested a build whose vendor script
 * is one of these and whose app script reads, part by part, as one of these builds, by the
 * fingerprints in fingerprint/recorded.ts. This list stays the fast path, which sends
 * nothing.
 */
export const TESTED_BUILDS: readonly (readonly [string, string])[] = [
  ['app.454d9e95.js', 'chunk-vendors.7ab4925e.js'],
  ['app.020e81ed.js', 'chunk-vendors.7ab4925e.js'],
  ['app.a1e43722.js', 'chunk-vendors.7ab4925e.js'],
  ['app.ba450963.js', 'chunk-vendors.7ab4925e.js'],
];

/** Host labels in Thai and English, matched by exact equality after trimming. */
export const HOST_LABELS = {
  addHeading: ['รายการวิชาที่ต้องการลงทะเบียน', 'List of subjects to register'],
  early: ['(ล่วงหน้า)', '(In advance)'],
  resultHeading: ['รายการวิชาที่ลงทะเบียน', 'List of registered subjects.'],
  practiceRow: ['(ปฏิบัติ)', '(practice)'],
  lectureChip: ['ทฤษฎี', 'Lecture'],
  practiceChip: ['ปฏิบัติ', 'Practice'],
  steps: [
    ['เริ่มต้น', 'เลือกรายวิชา', 'เสร็จสิ้น'],
    ['Start', 'Select Subjects', 'Complete'],
  ],
  gradeDialog: [
    'มีวิชาที่เกรดยังไม่ออก',
    'There are subjects whose grades have not yet been released',
  ],
  confirmDialog: [
    'การลงทะเบียนล่วงหน้าสามารถลงได้ครั้งเดียว',
    'Pre-registration may only be completed once.',
  ],
  timeSlotDialog: ['รหัสวิชา:', 'Subject ID:'],
  toastPrefix: [
    'มีข้อผิดพลาดสำหรับการลงวิชา: ',
    'There was an error registering for the course: ',
  ],
  alreadyListed: [
    'มีวิชานี้อยู่ในรายการที่จะลงอยู่แล้ว',
    'This subject is already in the list.',
  ],
  clash: [
    'มีวันเวลาสอบชนกับวิชาที่เลือกไว้แล้ว',
    'มีวันเวลาเรียนชนกับวิชาที่เลือกไว้แล้ว',
    'An exam date and time conflict with the selected subjects.',
    'A class date and time conflict with the selected subjects.',
    'A practice exam date and time conflict with the selected subjects.',
    'A practice class date and time conflict with the selected subjects.',
  ],
  submitted: ['ลงทะเบียนล่วงหน้าสำเร็จ', 'Pre-Registration Complete'],
  violateCondition: [
    'ไม่ได้รับสิทธิ์เนื่องจากผิดเงื่อนไข',
    'You are not eligible because the conditions were not met.',
  ],
  creditRange: ['หน่วยกิตที่ลงได้', 'Credits available to the student'],
  creditTotal: ['หน่วยกิตรวมวิชาที่เลือกทั้งหมด', 'All registered credits'],
  term: ['ภาคการศึกษาที่', 'Semester'],
  /** The two controls fill presses by label: the local add button and the grade dialog's. */
  addButton: ['เพิ่ม', 'Add'],
  acknowledge: ['รับทราบ', 'Acknowledged'],
} as const;

/** The add row's inline background, by the host's status: pending, fits, clash. */
const ROW_COLOURS = new Map<string, 'pending' | 'fits' | 'clash'>([
  ['rgb(255, 241, 217)', 'pending'],
  ['rgb(219, 255, 184)', 'fits'],
  ['rgb(255, 207, 204)', 'clash'],
]);

/** The host status an add row background stands for, or undefined when unknown. */
export function rowColour(background: string) {
  return ROW_COLOURS.get(background);
}

/** The host list table's header cells, by the classes its render function gives them. */
export const LIST_HEADER_CLASSES: readonly (string | null)[] = [
  'delete',
  'subject-id',
  'subject-name',
  null,
  'section',
  null,
  null,
  'last-cell',
];

/** A section cell: the code, then an optional curriculum suffix the host adds. */
export const SECTION_LABEL = /^(\d{1,4})(?: \((.{1,60})\))?$/;

/** The term column of the panel header: the label, then semester / year. */
export const TERM_TEXT = /^(?:ภาคการศึกษาที่|Semester) : ([123]) \/ (\d{4})$/;

/** The credit lines after their label: a range whose ends may be unset, and a total. */
export const CREDIT_RANGE = /^: (\d{1,2}|NaN)? ?- ?(\d{1,2}|NaN)?$/;
export const CREDIT_TOTAL = /^: (\d{1,2})$/;

/** A host script name of the two kinds the build gate compares. */
export const SCRIPT_NAME = /^(?:app|chunk-vendors)\.[0-9a-f]{8}\.js$/;

/** A host app script name, the one the host check fetches (ADR-0079). */
export const APP_SCRIPT_NAME = /^app\.[0-9a-f]{8}\.js$/;

/** A host vendor script name, which the host check requires to be a tested one. */
export const VENDOR_SCRIPT_NAME = /^chunk-vendors\.[0-9a-f]{8}\.js$/;

/** Whether a text equals one of the host labels after trimming. */
export function isLabel(
  text: string | null | undefined,
  set: readonly string[],
): boolean {
  return set.includes((text ?? '').trim());
}

/**
 * Whether a vendor script name is one KCP was tested with. The host check fingerprints
 * the app script only; the Vue and Vuetify runtime the actuator relies on stays exact.
 */
export function isTestedVendor(name: string): boolean {
  return TESTED_BUILDS.some(([, vendors]) => vendors === name);
}

/** The page's one app and one vendor script name, or null when it has not one of each. */
export function hostPair(
  names: readonly string[],
): { app: string; vendors: string } | null {
  const apps = [...new Set(names.filter((name) => APP_SCRIPT_NAME.test(name)))];
  const vendors = [
    ...new Set(names.filter((name) => VENDOR_SCRIPT_NAME.test(name))),
  ];
  const [app] = apps;
  const [vendor] = vendors;
  return apps.length === 1 && vendors.length === 1 && app && vendor
    ? { app, vendors: vendor }
    : null;
}

/** Whether both script names of one tested build are on the page. */
export function isTestedBuild(names: readonly string[]): boolean {
  return TESTED_BUILDS.some((build) =>
    build.every((name) => names.includes(name)),
  );
}
