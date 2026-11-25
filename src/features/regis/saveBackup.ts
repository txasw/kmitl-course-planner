// Save another section group to the plan from registration day (owner ruling 11A): the
// group the student chose for this registration, or the one the page lists instead of the
// planned one. The save moves the subject to that group through the plan's own
// transaction, so pair atomicity, the term check, and the clash rules hold, and the
// subject's choice clears, since the plan now names that group itself.

import type { Plan } from '@/lib/domain/plan';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { RowAlternative } from '@/lib/regis/checklist';
import { kitSubjectCourse } from '@/lib/regis/kit';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { planStore } from '@/features/plans/planStore';
import { toastStore } from '@/features/shell/toastStore';
import { regisStore } from './regisStore';

export function saveBackupToPlan(
  plan: Plan,
  kit: RegistrationKit,
  subjectId: string,
  option: RowAlternative,
  t: Translate,
): void {
  const subject = kit.subjects.find((item) => item.subjectId === subjectId);
  const chosenId = option.ids[0];
  if (subject === undefined || chosenId === undefined) return;
  const course = kitSubjectCourse(subject);
  const section = course.sections.find(
    (item) => item.teachTableId === chosenId,
  );
  if (section === undefined) return;
  const removeIds = plan.entries
    .filter((entry) => entry.subjectId === subjectId)
    .map((entry) => entry.teachTableId);
  const outcome = planStore
    .getState()
    .apply(
      removeIds,
      { course, section, sourceQuery: subject.sourceQuery },
      'move',
      plan.id,
    );
  if (!outcome.ok) {
    toastStore.getState().show('error', t('regis.saveBlocked'));
    return;
  }
  regisStore.getState().setChoice(plan, subjectId, null);
  const codes = option.sections.map((item) => item.section).join(' ');
  toastStore
    .getState()
    .show('success', fillTemplate(t('regis.saved'), { codes }));
}
