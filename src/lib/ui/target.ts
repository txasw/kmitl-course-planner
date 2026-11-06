// The pointer target size for a control, read from the --kcp-target-* tokens on the
// shadow host. A control is at least 24 px in each direction, the WCAG 2.5.8 minimum,
// and at least 44 px under a coarse pointer, so a finger can hit it without touching its
// neighbour. The classes set minimums only, so a control that is already larger keeps
// its own size.

export const TARGET_SIZE =
  'min-h-(--kcp-target-min) min-w-(--kcp-target-min) pointer-coarse:min-h-(--kcp-target-touch) pointer-coarse:min-w-(--kcp-target-touch)';
