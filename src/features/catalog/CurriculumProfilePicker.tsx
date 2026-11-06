// The open to my curriculum filter in the filter popover (ADR-0061). The switch keeps
// only the sections whose offeredTo groupings include the student's curriculum and
// class year, and its note says the groupings come from the current search, since a
// class search lists one grouping per section even when others share it. With no
// saved curriculum, turning the switch on opens the picker in place instead, and the
// filter applies once a curriculum is chosen; cancelling leaves the switch off. The
// picker reuses the class tab's selects without the all options and without the
// term, prefilled from the class search, and its choice persists in the preferences.

import { useId, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Switch } from '@/components/Switch';
import {
  profileDraft,
  profileFromSelection,
  type CurriculumProfile,
  type CurriculumSelection,
} from '@/lib/catalog/curriculumProfile';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ReferenceLists } from '@/lib/reference/filters';
import { describeGrouping } from '@/lib/search/describeQuery';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { CurriculumFields } from '@/features/search/CurriculumFields';
import { searchStore } from '@/features/search/searchStore';
import { useReferenceLists } from '@/features/search/useReferenceLists';
import { uiStore } from '@/features/shell/uiStore';
import { catalogStore } from './catalogStore';

const SECONDARY = `rounded-kcp border border-border px-3 py-1 text-xs text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`;

interface CurriculumProfilePickerProps {
  initial: CurriculumSelection;
  reference: ReferenceLists;
  locale: Locale;
  t: Translate;
  onApply: (profile: CurriculumProfile) => void;
  onCancel: () => void;
}

export function CurriculumProfilePicker({
  initial,
  reference,
  locale,
  t,
  onApply,
  onCancel,
}: CurriculumProfilePickerProps) {
  const [draft, setDraft] = useState(initial);
  const hintId = useId();
  const profile = profileFromSelection(draft);
  return (
    <div
      role="group"
      aria-label={t('offeredTo.setProfile')}
      className="flex w-72 max-w-full flex-col gap-2 rounded-kcp border border-border p-2"
    >
      <span className="text-xs font-semibold text-ink-soft">
        {t('offeredTo.setProfile')}
      </span>
      <CurriculumFields
        value={draft}
        includeAll={false}
        reference={reference}
        locale={locale}
        t={t}
        patch={(patch) => {
          setDraft((current) => ({ ...current, ...patch }));
        }}
      />
      {profile === null ? (
        <p id={hintId} className="text-xs text-ink-soft">
          {t('offeredTo.incomplete')}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={SECONDARY}>
          {t('action.cancel')}
        </button>
        <button
          type="button"
          aria-disabled={profile === null || undefined}
          aria-describedby={profile === null ? hintId : undefined}
          onClick={() => {
            if (profile !== null) {
              onApply(profile);
            }
          }}
          className={`rounded-kcp bg-primary-strong px-3 py-1 text-xs font-semibold text-surface ${TARGET_SIZE} ${
            profile === null
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-primary-hover'
          } ${FOCUS_OUTLINE}`}
        >
          {t('offeredTo.apply')}
        </button>
      </div>
    </div>
  );
}

interface CurriculumFilterProps {
  active: boolean;
  locale: Locale;
  t: Translate;
}

export function CurriculumFilter({ active, locale, t }: CurriculumFilterProps) {
  const profile = useStore(uiStore, (state) => state.curriculumProfile);
  const classForm = useStore(searchStore, (state) => state.byClass);
  const reference = useReferenceLists();
  const [picking, setPicking] = useState(false);
  const noteId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const profileText = useMemo(() => {
    if (profile === null) {
      return '';
    }
    const summary = describeGrouping(profile, reference, locale, t);
    return [summary.primary, ...summary.qualifiers].join(' ');
  }, [profile, reference, locale, t]);

  // The picker unmounts on apply and on cancel, so focus returns to the switch
  // rather than falling out of the popover.
  const closePicker = () => {
    setPicking(false);
    rootRef.current
      ?.querySelector<HTMLElement>('[role="switch"]')
      ?.focus({ preventScroll: true });
  };

  const handleApply = (next: CurriculumProfile) => {
    uiStore.getState().setCurriculumProfile(next);
    catalogStore.getState().setCurriculum(next);
    closePicker();
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      <Switch
        checked={active}
        label={t('offeredTo.filter')}
        describedBy={noteId}
        onChange={(checked) => {
          if (!checked) {
            catalogStore.getState().setCurriculum(null);
          } else if (profile === null) {
            setPicking(true);
          } else {
            catalogStore.getState().setCurriculum(profile);
          }
        }}
      />
      <p id={noteId} className="px-2 text-xs text-ink-soft">
        {t('offeredTo.scope')}
      </p>
      {profile !== null && !picking ? (
        <div className="flex flex-col gap-1 px-2 text-xs">
          <p className="min-w-0 break-words">
            <span className="text-ink-soft">{t('offeredTo.mine')}</span>{' '}
            <span className="text-ink">{profileText}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setPicking(true);
            }}
            className={`self-start rounded-kcp px-1 text-primary-strong hover:bg-primary-soft ${TARGET_SIZE} ${FOCUS_RING}`}
          >
            {t('offeredTo.change')}
          </button>
        </div>
      ) : null}
      {picking ? (
        <CurriculumProfilePicker
          initial={profileDraft(profile, classForm)}
          reference={reference}
          locale={locale}
          t={t}
          onApply={handleApply}
          onCancel={closePicker}
        />
      ) : null}
    </div>
  );
}
