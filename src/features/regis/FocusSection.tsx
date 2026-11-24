// The subject in focus on the helper card: its status band, its section tile beside its id
// and name, and the action row its status calls for. A subject still to add offers Copy
// ID and Add for me; one the page turned down offers Copy ID and Other section, or Add for
// me again for a section the page shows over subscribed; one the page lists with another
// section offers to use that section in the plan; a settled subject offers nothing. When
// a fill stops on the subject, the reason and what to do next sit under the row.

import { useId } from 'react';
import { useStore } from 'zustand';
import { Hourglass, Layers, ShieldAlert } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { fillTemplate } from '@/lib/i18n/template';
import { pickLocalized } from '@/lib/i18n/localize';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ChecklistRow, RowAlternative } from '@/lib/regis/checklist';
import {
  STATUS_TONE,
  needsAction,
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
import { clearStop, helperStore } from './helperStore';
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
  model: HelperModel;
  row: ChecklistRow;
  status: HelperStatus;
  coarse: boolean;
  locale: Locale;
  t: Translate;
}

/** The kit group the page lists for a subject listed with another section, if known. */
function listedGroup(row: ChecklistRow): RowAlternative | null {
  const codes = [...(row.observed?.codes ?? [])].sort().join(' ');
  return (
    row.alternatives.find(
      (option) =>
        option.sections
          .map((section) => section.section)
          .sort()
          .join(' ') === codes,
    ) ?? null
  );
}

function codesOf(option: { sections: readonly { section: string }[] }) {
  return option.sections.map((section) => section.section).join(' ');
}

export function FocusSection({
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
  const tone = STATUS_TONE[status];
  const id = row.subjectId;
  const shown =
    status === 'other' ? (listedGroup(row)?.sections ?? null) : null;
  const parts = sectionParts(shown ?? row.chosen?.sections ?? row.planned, t);
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
  const targetIds = (row.chosen?.sections ?? row.planned).map(
    (section) => section.teachTableId,
  );
  const choose = (option: SectionOption) => {
    if (plan === null) return;
    if (run.status === 'stopped') clearStop(run);
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
      onChoose={choose}
      align={align}
      t={t}
    >
      {render}
    </SectionListbox>
  );
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
    <div className="flex flex-col">
      <div
        className={`flex min-h-10 items-center gap-2 border-t px-3 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none ${
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
      <div className="flex items-center gap-3 p-3">
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
          <Pills
            row={row}
            status={status}
            prerequisites={prerequisites}
            t={t}
          />
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
              reasonId={block === 'stale' ? STALE_TEXT_ID : reasonId}
              coarse={coarse}
              t={t}
            />
          )}
        </div>
      ) : null}
      {needsAction(status) && block !== null && block !== 'stale' ? (
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
    </div>
  );
}

function Pills({
  row,
  status,
  prerequisites,
  t,
}: {
  row: ChecklistRow;
  status: HelperStatus;
  prerequisites: readonly string[];
  t: Translate;
}) {
  const pills = [
    prerequisites.length > 0 ? (
      <Pill key="grade" tone="warn" icon={<Hourglass size={12} />}>
        {fillTemplate(t('regis.waitGrade'), { ids: prerequisites.join(' ') })}
      </Pill>
    ) : status === 'cond' ? (
      <Pill key="cond" tone="warn" icon={<ShieldAlert size={12} />}>
        {t('regis.short.cond')}
      </Pill>
    ) : null,
    status === 'other' ? (
      <Pill key="plan" tone="neutral">
        {fillTemplate(t('regis.planSection'), {
          codes: codesOf({ sections: row.planned }),
        })}
      </Pill>
    ) : null,
    status === 'todo' && row.duplicateCode !== null ? (
      <Pill key="dup" tone="neutral" icon={<Layers size={12} />}>
        {t('regis.severalCurricula')}
      </Pill>
    ) : null,
  ].filter((pill) => pill !== null);
  return pills.length === 0 ? null : (
    <span className="mt-1 flex flex-wrap gap-1">{pills}</span>
  );
}
