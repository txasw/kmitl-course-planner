// Save a backup section chosen on registration day to the plan (owner ruling 11A). A
// choice stays a checklist mark until the student presses save; the save then moves the
// subject to the chosen group through the plan's own transaction, so pair atomicity, the
// term check, and the clash rules hold, and the mark becomes added, since the plan now
// matches what the student entered on the page.

import type { Plan } from '@/lib/domain/plan';
import type { Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { ChecklistRow } from '@/lib/regis/checklist';
import { kitSubjectCourse } from '@/lib/regis/kit';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { planStore } from '@/features/plans/planStore';
import { toastStore } from '@/features/shell/toastStore';
import { regisStore } from './regisStore';

export function saveBackupToPlan(
  plan: Plan,
  kit: RegistrationKit,
  row: ChecklistRow,
  t: Translate,
): void {
  const subject = kit.subjects.find((item) => item.subjectId === row.subjectId);
  const chosenId = row.chosen?.ids[0];
  if (subject === undefined || chosenId === undefined || row.chosen === null) {
    return;
  }
  const course = kitSubjectCourse(subject);
  const section = course.sections.find(
    (item) => item.teachTableId === chosenId,
  );
  if (section === undefined) return;
  const removeIds = plan.entries
    .filter((entry) => entry.subjectId === row.subjectId)
    .map((entry) => entry.teachTableId);
  const outcome = planStore
    .getState()
    .apply(
      removeIds,
      { course, section, sourceQuery: subject.sourceQuery },
      'move',
    );
  if (!outcome.ok) {
    toastStore.getState().show('error', t('regis.saveBlocked'));
    return;
  }
  regisStore.getState().setMark(plan, row.subjectId, {
    state: 'added',
    at: new Date().toISOString(),
  });
  const codes = row.chosen.sections.map((item) => item.section).join(' ');
  toastStore
    .getState()
    .show('success', fillTemplate(t('regis.saved'), { codes }));
}
