// The shared group renderer of the updates dialog. Every group, from new clashes and
// missing sections to the other changes, renders through the same heading, list, and
// item, so the groups differ only in their items. An item names the section, carries one
// badge per change kind, states any clash a change created, and shows each changed field
// as a before and a now line in text, so the change reads the same to every user. Items
// are list items rather than articles, since the list is one review and not a feed. The
// entries with nothing to review sit in one collapsed group under the same name line.

import type { ReactNode } from 'react';
import { Pill } from '@/components/Pill';
import type { PlanEntry, ReviewKind } from '@/lib/domain/plan';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { pickLocalizedWithLang } from '@/lib/i18n/localize';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_RING } from '@/lib/ui/focus';
import type {
  UpdateGroup,
  UpdateGroupKey,
  UpdateItem,
} from '@/lib/planner/updateReview';
import { describeEntryDiff } from '@/features/planner/describeEntryDiff';

const GROUP_LABEL: Record<UpdateGroupKey, TranslationKey> = {
  clash: 'updates.group.clash',
  exam: 'updates.group.exam',
  timeRoom: 'updates.group.timeRoom',
  other: 'updates.group.other',
};

const KIND_LABEL: Record<ReviewKind, TranslationKey> = {
  time_changed: 'updates.kind.time',
  room_changed: 'updates.kind.room',
  pair_changed: 'updates.kind.pair',
  exam_changed: 'updates.kind.exam',
  closed: 'updates.kind.closed',
  missing: 'updates.kind.missing',
};

interface UpdateGroupListProps {
  groups: UpdateGroup[];
  locale: Locale;
  t: Translate;
  /** The per item actions, rendered under the item's details. */
  renderActions?: (item: UpdateItem) => ReactNode;
}

/** The subject id, the locale primary name, and the section of an entry. */
function EntryName({
  entry,
  locale,
  t,
  emphasis,
}: {
  entry: PlanEntry;
  locale: Locale;
  t: Translate;
  emphasis: boolean;
}) {
  const meta = entry.snapshot.subjectMeta;
  const name = pickLocalizedWithLang(meta.nameTh, meta.nameEn, locale);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`tabular-nums ${emphasis ? 'font-semibold' : ''}`}>
        {entry.subjectId}
      </span>
      <span lang={name.lang} className="min-w-0 break-words">
        {name.value}
      </span>
      <span className="text-xs text-ink-soft">
        {t('section.code')} {entry.section}
      </span>
    </p>
  );
}

function UpdateItemRow({
  item,
  locale,
  t,
  actions,
}: {
  item: UpdateItem;
  locale: Locale;
  t: Translate;
  actions: ReactNode;
}) {
  const rows = describeEntryDiff(item, locale, t);

  return (
    <li className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-0">
      <EntryName entry={item.entry} locale={locale} t={t} emphasis />
      <p className="flex flex-wrap gap-1">
        {item.kinds.map((kind) => (
          <Pill key={kind} tone={kind === 'missing' ? 'danger' : 'warn'}>
            {t(KIND_LABEL[kind])}
          </Pill>
        ))}
      </p>
      {item.clashes.map((clash) => (
        <p
          key={`${clash.subjectId}-${clash.section}`}
          className="text-xs text-danger"
        >
          {fillTemplate(t('updates.newConflict'), {
            subject: clash.subjectId,
            section: clash.section,
          })}
        </p>
      ))}
      {rows.length > 0 ? (
        <dl className="flex flex-col gap-1.5 text-xs">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-ink-soft">{row.label}</dt>
              <dd className="grid grid-cols-[auto_1fr] gap-x-2">
                <span className="text-ink-soft">{t('updates.before')}</span>
                <span className="break-words text-ink-soft">{row.old}</span>
                <span className="text-ink-soft">{t('updates.after')}</span>
                <span className="break-words">{row.next}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions}
    </li>
  );
}

export function UpdateGroupList({
  groups,
  locale,
  t,
  renderActions,
}: UpdateGroupListProps) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-ink-soft">
            {t(GROUP_LABEL[group.key])}
          </h3>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <UpdateItemRow
                key={item.entry.teachTableId}
                item={item}
                locale={locale}
                t={t}
                actions={renderActions?.(item) ?? null}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function UnchangedGroup({
  entries,
  locale,
  t,
}: {
  entries: PlanEntry[];
  locale: Locale;
  t: Translate;
}) {
  return (
    <details>
      <summary
        className={`cursor-pointer rounded-kcp-inner py-1 text-xs text-ink-soft hover:text-ink ${FOCUS_RING}`}
      >
        {fillTemplate(t('updates.unchangedGroup'), { count: entries.length })}
      </summary>
      <ul className="mt-1 flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.teachTableId}>
            <EntryName entry={entry} locale={locale} t={t} emphasis={false} />
          </li>
        ))}
      </ul>
    </details>
  );
}
