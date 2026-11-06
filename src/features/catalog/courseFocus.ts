// Where focus lands on a course card after the card re-renders under it. An add
// collapses the card and a remove turns its rows addable again, so the control that was
// pressed unmounts and the card's toggle, which stays in place, takes over. The toggle is
// looked up after the commit, because the header remounts when the card changes between
// a drag source and a plain header. Each card names its subject id in data-course-card.

/** The disclosure toggle of the card for the subject, or null when none is rendered. */
export function courseToggle(
  scope: ParentNode,
  subjectId: string,
): HTMLElement | null {
  for (const card of scope.querySelectorAll<HTMLElement>(
    '[data-course-card]',
  )) {
    if (card.dataset.courseCard === subjectId) {
      return card.querySelector<HTMLElement>('[data-course-toggle]');
    }
  }
  return null;
}
