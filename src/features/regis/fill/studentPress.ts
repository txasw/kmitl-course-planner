// The student press a fill run needs (ADR-0078). Only the click handler of a KCP fill
// button may issue one, and lint keeps the issuer out of every other module, so no
// effect, timer, observer, hover, shortcut, or message can start a run. The press is
// issued only for a trusted single click the browser counts as user activation, made
// within a second, on a control shown for at least half a second, so a bounce or a
// layout shift does not count. Each press starts one run: the engine consumes it.

const MAX_AGE_MS = 1000;
const MIN_SHOWN_MS = 500;

class Press {
  readonly #brand = true;
  get brand(): boolean {
    return this.#brand;
  }
}

/** An opaque proof that the student pressed a fill control. */
export type StudentPress = Press;

const issued = new WeakSet<Press>();

// A browser without the activation API still requires a trusted event.
function hasUserActivation(): boolean {
  return 'userActivation' in navigator
    ? navigator.userActivation.isActive
    : true;
}

/** The parts of a click the checks read. */
export interface PressEvent {
  isTrusted: boolean;
  detail: number;
  timeStamp: number;
}

/**
 * A press for a click on a fill button shown since `shownAt`, or null when the click does
 * not prove a deliberate press. Times are in the event's clock, milliseconds.
 */
export function issueStudentPress(
  event: PressEvent,
  shownAt: number,
  now: number = performance.now(),
  active: boolean = hasUserActivation(),
): StudentPress | null {
  if (!event.isTrusted || !active || event.detail > 1) return null;
  if (now - event.timeStamp > MAX_AGE_MS || now - shownAt < MIN_SHOWN_MS) {
    return null;
  }
  const press = new Press();
  issued.add(press);
  return press;
}

/** Use a press once; a second use, or a press this module never issued, is refused. */
export function consumeStudentPress(press: StudentPress): boolean {
  return issued.delete(press);
}
