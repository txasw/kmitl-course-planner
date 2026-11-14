// The meeting place shown on blocks, catalog rows, and exports. The API carries two
// building fields: classbuilding is the readable name (พระเทพฯ-D, สำนักหอสมุดกลาง) and
// building_no is an internal code (D01, ECC) or a stray value such as a floor. The
// readable name wins. Most rooms already open with their building's letter code
// (D-510, ECC-CE804, HM-304), and repeating the building there only adds noise, so the
// building is dropped when the room's leading code matches one of the building's codes.

const LEADING_CODE = /^[A-Za-z]+/;
const TRAILING_CODE = /-([A-Za-z]+)$/;

function trimmed(value: string | null): string {
  return value?.trim() ?? '';
}

/** The leading Latin letter run of a value, upper cased, or null when it opens otherwise. */
function leadingCode(value: string): string | null {
  return LEADING_CODE.exec(value)?.[0].toUpperCase() ?? null;
}

/** Every letter code a building field names: a leading run such as D in D01 or ECC, and
 * a trailing one such as D in พระเทพฯ-D. */
function buildingCodes(values: string[]): Set<string> {
  const codes = new Set<string>();
  for (const value of values) {
    const leading = leadingCode(value);
    if (leading !== null) {
      codes.add(leading);
    }
    const trailing = TRAILING_CODE.exec(value)?.[1];
    if (trailing !== undefined) {
      codes.add(trailing.toUpperCase());
    }
  }
  return codes;
}

/**
 * The building to show beside a room: the trimmed classbuilding, then the trimmed
 * building_no, or an empty string when the room already opens with the building's code.
 */
export function readableBuilding(
  classbuilding: string | null,
  buildingNo: string | null,
  room: string,
): string {
  const name = trimmed(classbuilding);
  const code = trimmed(buildingNo);
  const roomCode = leadingCode(room.trim());
  if (roomCode !== null && buildingCodes([name, code]).has(roomCode)) {
    return '';
  }
  return name !== '' ? name : code;
}

/**
 * The key two meetings are compared by when deciding whether a section moved room. It is
 * the room alone, trimmed with inner whitespace collapsed. The building is left out on
 * purpose: snapshots saved before the readable name was preferred store building_no, and
 * no snapshot keeps the raw fields that would let the new rule be replayed, so comparing
 * the building would flag every stored entry as moved on its next revalidation. The room
 * string carries the building code on most rows, and a snapshot always takes the fresh
 * building on reconcile, so only a move between two rooms of the same name in different
 * buildings goes unreported.
 */
export function placeKey(meeting: { room: string }): string {
  return meeting.room.trim().replace(/\s+/g, ' ');
}
