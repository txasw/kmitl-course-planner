// The subject in focus on the helper card: its status band, its section tile beside its id
// and name, and the action row its status calls for. A subject still to add offers Copy
// ID and Add for me; one the page turned down offers Copy ID and Other section, or Add for
// me again for a section the page shows over subscribed; one the page lists with another
// section offers to use that section in the plan; a settled subject offers nothing. When
// a fill stops on the subject, the reason and what to do next sit under the row. On
// regular registration a section chosen earlier still shows, since choices are kept per
// plan and term with no page, and says only that it was chosen earlier for this term,
// which holds whichever page it was chosen on, until the student chooses again here.

import { useId, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { pickLocalized } from '@/lib/i18n/localize';
import type { Locale, Translate } from '@/lib/i18n/t';
import {
  listedGroup,
  shownSections,
  type ChecklistRow,
} from '@/lib/regis/checklist';
import {
  STATUS_TONE,
  needsAction,
  type AddBlock,
  type HelperStatus,
} from '@/lib/regis/helperStatus';
import {
  BlockedAddButton,
  CopyIdButton,
  PickOtherButton,
  UseInPlanButton,
} from './ActionRow';
import {
  AddForMeButton,
  RunProgress,
  useShowCondition,
} from './fill/FillControls';
import { FocusPills } from './FocusPills';
import { KIT_TEXT_ID } from './KitBar';
import { clearStop, helperStore, noteChoiceHere } from './helperStore';
import { regisStore } from './regisStore';
import { saveBackupToPlan } from './saveBackup';
import {
  SectionListbox,
  sectionOptions,
  type SectionOption,
} from './SectionListbox';
import { SectionTile, partsText, sectionParts } from './SectionTile';
import { StatusIcon } from './StatusIcon';
import { STALE_FILL, TONE_FILL, TONE_ICON, bandKey } from './statusMeta';
import { useAddBlock } from './useAddBlock';
import type { HelperModel } from './useHelperModel';

/** The id of the unreadable bar's text, which a blocked add points at. */
export const STALE_TEXT_ID = 'kcp-regis-stale';

interface FocusSectionProps {
  /** The queue of chips, which scrolls with the band and the body. */
  queue: ReactNode;
  model: HelperModel;
  row: ChecklistRow;
  status: HelperStatus;
  coarse: boolean;
  locale: Locale;
  t: Translate;
}

/** The blocks the kit bar states in its own words, stale data with its press among them. */
const KIT_BLOCKS: ReadonlySet<AddBlock> = new Set<AddBlock>([
  'noKit',
  'kitStale',
  'preparing',
]);

function codesOf(option: { sections: readonly { section: string }[] }) {
  return option.sections.map((section) => section.section).join(' ');
}

export function FocusSection({
  queue,
  model,
  row,
  status,
  coarse,
  locale,
  t,
}: FocusSectionProps) {
  const reasonId = useId();
  const { plan, kit, run, stale } = model;
  const cleared = useStore(helperStore, (state) => state.clearedStop);
  const choseHere = useStore(helperStore, (state) => state.choseHere);
  const tone = STATUS_TONE[status];
  const id = row.subjectId;
  const parts = sectionParts(shownSections(row, status === 'other'), t);
  const swap =
    status === 'other'
      ? listedGroup(row)
      : needsAction(status)
        ? row.chosen
        : null;
  const running = run.status === 'running' ? run : null;
  const stopped =
    run.status === 'stopped' &&
    run !== cleared &&
    (run.subjectId === id || run.subjectId === null)
      ? run
      : null;

  const { block, reason } = useAddBlock(model, row, t);
  // A reason the bar under the header already states is read from there, not said twice.
  const barId =
    block === 'stale'
      ? STALE_TEXT_ID
      : block !== null && KIT_BLOCKS.has(block) && model.bar === 'kit'
        ? KIT_TEXT_ID
        : null;
  const targetIds = (row.chosen?.sections ?? row.planned).map(
    (section) => section.teachTableId,
  );
  const choose = (option: SectionOption) => {
    if (plan === null) return;
    if (run.status === 'stopped') clearStop(run);
    if (model.route === 'registration') noteChoiceHere(id);
    regisStore
      .getState()
      .setChoice(plan, id, option.planned ? null : option.ids);
  };
  const listbox = (
    align: 'start' | 'end',
    render: Parameters<typeof SectionListbox>[0]['children'],
  ) => (
    <SectionListbox
      subjectId={id}
      options={sectionOptions(row)}
      chosen={targetIds}
      refused={status === 'refused' ? targetIds : null}
      hasKit={model.hasKit}
      olderData={model.staleKit !== null}
      carried={carried}
      onChoose={choose}
      align={align}
      t={t}
    >
      {render}
    </SectionListbox>
  );
  const carried =
    model.route === 'registration' &&
    row.chosen !== null &&
    !choseHere.includes(id);
  const pickable =
    needsAction(status) && !model.sent && row.alternatives.length > 0;

  const name = pickLocalized(row.nameTh, row.nameEn, locale);
  const prerequisites =
    running?.subjectId === id && running.step === 'conditional'
      ? running.prerequisites
      : (row.observed?.prerequisites ?? []);
  useShowCondition(
    running?.subjectId === id &&
      running.step === 'conditional' &&
      prerequisites.length > 0
      ? id
      : null,
  );

  return (
    <>
      <div className="kcp-scroll flex min-h-0 flex-1 flex-col overflow-y-auto kcp-fade-in">
        {queue}
        <div
          className={`flex shrink-0 min-h-10 items-center gap-2 border-t px-3 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${
            stale ? STALE_FILL : TONE_FILL[tone]
          }`}
        >
          <StatusIcon
            status={status}
            size={18}
            className={
              stale
                ? 'text-ink-muted'
                : tone === 'neutral' || tone === 'busy'
                  ? TONE_ICON[tone]
                  : ''
            }
          />
          <span>{t(bandKey(status))}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 p-3">
          {pickable ? (
            listbox('start', (trigger) => (
              <SectionTile
                subjectId={id}
                parts={parts}
                trigger={{
                  ...trigger,
                  label: `${partsText(parts)}, ${t('regis.pickSection')}`,
                }}
              />
            ))
          ) : (
            <SectionTile subjectId={id} parts={parts} />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-ink tabular-nums">
              {id}
            </span>
            <span className="text-sm text-ink-soft">{name}</span>
            <FocusPills
              row={row}
              status={status}
              prerequisites={prerequisites}
              plannedCodes={codesOf({ sections: row.planned })}
              locale={locale}
              t={t}
            />
            {carried ? (
              <span data-carried-choice className="mt-1 text-xs text-ink-soft">
                {t('regis.chosenEarlier')}
              </span>
            ) : null}
            {model.staleKit !== null && row.chosen !== null ? (
              <span data-older-data className="mt-1 text-xs text-warn">
                {t('regis.chosenOlder')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {swap !== null && kit !== null && plan !== null ? (
        <div className="flex px-3 pb-3">
          <UseInPlanButton
            codes={codesOf(swap)}
            onSave={() => {
              saveBackupToPlan(plan, kit, id, swap, t);
            }}
            t={t}
          />
        </div>
      ) : null}
      {running?.subjectId === id ? (
        <div className="flex gap-2 px-3 pb-3">
          <RunProgress run={running} t={t} />
        </div>
      ) : needsAction(status) && !model.sent ? (
        <div className="flex gap-2 px-3 pb-3">
          <CopyIdButton subjectId={id} t={t} />
          {status === 'refused' || status === 'clash' ? (
            listbox('end', (trigger) => (
              <PickOtherButton trigger={trigger} t={t} />
            ))
          ) : block === null && plan !== null && kit !== null ? (
            <AddForMeButton
              row={row}
              plan={plan}
              kit={kit}
              allowFull={status === 'full'}
              t={t}
            />
          ) : (
            <BlockedAddButton
              reason={reason}
              reasonId={barId ?? reasonId}
              coarse={coarse}
              t={t}
            />
          )}
        </div>
      ) : null}
      {needsAction(status) && block !== null && barId === null ? (
        <p
          id={reasonId}
          className={coarse ? 'px-3 pb-3 text-xs text-ink-soft' : 'sr-only'}
        >
          {reason}
        </p>
      ) : null}
      {stopped === null ? null : (
        <p
          data-fill-stop={stopped.reason}
          className="px-3 pb-3 text-xs text-ink-soft"
        >
          {t(`regis.fill.stop.${stopped.reason}`)}
        </p>
      )}
    </>
  );
}
