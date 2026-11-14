// The way forward of the notice the feedback strip shows. Every notice action carries
// data-feedback-action, so a blocked or cross term add can move focus to the first one;
// the dismiss control does not, since the way forward comes before the way out.

/**
 * The first action of the notice the strip shows: the first alternative chip of a
 * blocked notice, or its reveal action when none fits, or the switch of a cross term
 * notice. A blocked or cross term add moves focus here, so a keyboard user can take the
 * way forward without hunting for it.
 */
export function firstFeedbackAction(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-feedback-action]');
}
