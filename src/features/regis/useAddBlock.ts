// Why Add for me cannot run for a subject now, or Add all for me for the subjects still to
// add, with the short sentence that says so, read the same way on the card, on each list
// row, and in the more menu.

import type { ChecklistRow } from '@/lib/regis/checklist';
import { fillTarget } from '@/lib/regis/fillPlan';
import { addForMeBlock, type AddBlock } from '@/lib/regis/helperStatus';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { useStore } from 'zustand';
import { useFillGate } from './fill/FillControls';
import { regisStore } from './regisStore';
import type { HelperModel } from './useHelperModel';

const BLOCK_TEXT: Readonly<Record<AddBlock, TranslationKey>> = {
  otherPage: 'regis.addForMe.otherPage',
  checking: 'regis.addForMe.checking',
  unavailable: 'regis.addForMe.unavailable',
  off: 'regis.addForMe.off',
  preparing: 'regis.addForMe.preparing',
  noKit: 'regis.noKitShort',
  stale: 'regis.unreadable',
  termMismatch: 'regis.state.termMismatch',
  notInStep: 'regis.addForMe.onlyInStep',
  busy: 'regis.addForMe.busy',
};

export interface AddBlockResult {
  block: AddBlock | null;
  reason: string;
}

/**
 * The block for a press that names `first` as its first subject, which decides whether the
 * kit gives it a target; `busy` says whether a run already active stands in the way.
 */
function useBlock(
  model: HelperModel,
  first: ChecklistRow | null,
  busy: boolean,
  t: Translate,
): AddBlockResult {
  const gate = useFillGate();
  const preparing = useStore(
    regisStore,
    (state) => state.run.status === 'running',
  );
  const { plan, kit, run } = model;
  const busyId = run.status === 'running' ? run.subjectId : null;
  const block = addForMeBlock({
    onPage: model.route === 'preRegistration',
    available:
      plan !== null &&
      gate !== 'checking' &&
      gate !== 'untestedBuild' &&
      gate !== 'latched',
    checking: plan !== null && gate === 'checking',
    off: gate === 'off',
    preparing,
    target:
      plan !== null &&
      first !== null &&
      typeof fillTarget(first, plan, kit) !== 'string',
    stale: model.stale,
    termMismatch: model.termMismatch,
    inStep: model.inStep,
    busy,
  });
  return {
    block,
    reason:
      block === null
        ? ''
        : fillTemplate(t(BLOCK_TEXT[block]), { subjectId: busyId ?? '' }),
  };
}

export function useAddBlock(
  model: HelperModel,
  row: ChecklistRow,
  t: Translate,
): AddBlockResult {
  const { run } = model;
  return useBlock(
    model,
    row,
    run.status === 'running' && run.subjectId !== row.subjectId,
    t,
  );
}

/** The block of Add all for me, whose run starts on the first subject it names. */
export function useAddAllBlock(
  model: HelperModel,
  rows: readonly ChecklistRow[],
  t: Translate,
): AddBlockResult {
  return useBlock(model, rows[0] ?? null, model.run.status === 'running', t);
}
