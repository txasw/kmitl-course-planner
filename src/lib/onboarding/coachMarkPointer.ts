// The coach mark pointer as pure geometry (ADR-0072). The pointer box spans the gap left
// of the launcher and the launcher's own column, from the callout's line down to just
// above the launcher. The stroke leaves the end of the callout at the box's left edge,
// rises a little as a hand drawn line does, and swings down into the launcher's centre
// from above and to the right, where the arrowhead sits along the arrival direction. All
// numbers are CSS pixels of the measured box, so the curve never stretches.

export interface BoxSize {
  width: number;
  height: number;
}

export interface PointerGeometry {
  /** The stroke from the callout to the launcher, as an SVG path. */
  curve: string;
  /** The two arrowhead strokes at the launcher end, as one SVG path. */
  head: string;
}

/** Where the stroke leaves the callout: a few pixels past its end, on its line. */
const START_X = 6;
const START_Y = 18;
/** How far the stroke rises above its start before it turns down. */
const RISE = 12;
/** How far right of the end the second control point sits, which sets the swing. */
const SWING = 14;
const HEAD_LENGTH = 10;
const HEAD_SPREAD = Math.PI / 6;
/** Below this size there is no room for a pointer that reads as one. */
const MIN_SIZE = 24;

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function point(x: number, y: number): string {
  return `${round(x)} ${round(y)}`;
}

/**
 * The pointer in a box of the given size, ending over the centre of a launcher of the
 * given width at the box's right edge, or null before the box is measured or when it is
 * too small to hold one.
 */
export function pointerGeometry(
  box: BoxSize,
  launcherWidth: number,
): PointerGeometry | null {
  if (box.width < MIN_SIZE || box.height < MIN_SIZE || launcherWidth <= 0) {
    return null;
  }
  const endX = Math.max(START_X + 1, box.width - launcherWidth / 2);
  const endY = box.height;
  const startY = Math.min(START_Y, endY / 2);
  const c1x = START_X + (endX - START_X) * 0.75;
  const c1y = Math.max(0, startY - RISE);
  const c2x = endX + SWING;
  const c2y = startY + (endY - startY) * 0.3;

  // The arrowhead lies along the tangent at the end, which points from the second
  // control point to the end point.
  const angle = Math.atan2(endY - c2y, endX - c2x);
  const wing = (side: number): string =>
    point(
      endX - HEAD_LENGTH * Math.cos(angle + side * HEAD_SPREAD),
      endY - HEAD_LENGTH * Math.sin(angle + side * HEAD_SPREAD),
    );

  return {
    curve: `M ${point(START_X, startY)} C ${point(c1x, c1y)}, ${point(c2x, c2y)}, ${point(endX, endY)}`,
    head: `M ${wing(1)} L ${point(endX, endY)} L ${wing(-1)}`,
  };
}
