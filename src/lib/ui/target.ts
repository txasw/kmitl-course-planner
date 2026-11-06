// The pointer target size for a control, read from the --kcp-target-* tokens on the
// shadow host. A control is at least 24 px in each direction, the WCAG 2.5.8 minimum,
// and at least 44 px under a coarse pointer, so a finger can hit it without touching its
// neighbour. The classes set minimums only, so a control that is already larger keeps
// its own size.

/**
 * The 24 px minimum alone, without the growth under a coarse pointer, for a control that
 * is hidden under a coarse pointer, such as the placed block remove control, whose action
 * the detail sheet carries on touch.
 */
export const TARGET_MIN = 'min-h-(--kcp-target-min) min-w-(--kcp-target-min)';

/**
 * The height half alone, for a wide control that is the one item allowed to shrink in
 * its row, such as the header plan switcher, where a minimum width would push it over
 * its neighbours.
 */
export const TARGET_HEIGHT =
  'min-h-(--kcp-target-min) pointer-coarse:min-h-(--kcp-target-touch)';

export const TARGET_SIZE = `${TARGET_HEIGHT} min-w-(--kcp-target-min) pointer-coarse:min-w-(--kcp-target-touch)`;
