// Why Add for me cannot run for a subject now, with the short sentence that says so, read
// the same way on the card and on each list row.

import type { ChecklistRow } from '@/lib/regis/checklist';
import { fillTarget } from '@/lib/regis/fillPlan';
import { addForMeBlock, type AddBlock } from '@/lib/regis/helperStatus';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { useFillGate } from './fill/FillControls';
import type { HelperModel } from './useHelperModel';

const BLOCK_TEXT: Readonly<Record<AddBlock, TranslationKey>> = {
  unavailable: 'regis.addForMe.unavailable',
  off: 'regis.addForMe.off',
  noKit: 'regis.noKitShort',
  stale: 'regis.unreadable',
  termMismatch: 'regis.state.termMismatch',
  notInStep: 'regis.addForMe.onlyInStep',
  busy: 'regis.addForMe.busy',
};

export function useAddBlock(
  model: HelperModel,
  row: ChecklistRow,
  t: Translate,
): { block: AddBlock | null; reason: string } {
  const gate = useFillGate();
  const { plan, kit, run } = model;
  const busyId = run.status === 'running' ? run.subjectId : null;
  const block =
    plan === null
      ? 'unavailable'
      : addForMeBlock({
          available:
            model.route === 'preRegistration' &&
            gate !== 'untestedBuild' &&
            gate !== 'latched',
          off: gate === 'off',
          target: typeof fillTarget(row, plan, kit) !== 'string',
          stale: model.stale,
          termMismatch: model.termMismatch,
          inStep: model.inStep,
          busy: busyId !== null && busyId !== row.subjectId,
        });
  return {
    block,
    reason:
      block === null
        ? ''
        : fillTemplate(t(BLOCK_TEXT[block]), { subjectId: busyId ?? '' }),
  };
}
