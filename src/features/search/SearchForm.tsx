// The search rail: a tab bar over the three official search modes, the active
// tab's fields, and a submit that streams results into the catalog. Reference
// data loads once on mount; the term seeds from a persisted search or the host
// route. The four async surfaces each render a deliberate state.

import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import { buddhistYears, toBuddhistYear } from '@/lib/routing/academicTerms';
import {
  SEARCH_TABS,
  asSemester,
  buildTeachTableQueryForTab,
  isValidSubjectId,
  type SearchTab,
} from '@/lib/search/formState';
import { useTranslation } from '@/features/shell/useTranslation';
import { FOCUS_RING, FOCUS_OUTLINE } from '@/lib/ui/focus';
import {
  CategoryFields,
  ClassFields,
  SubjectIdInput,
  TermFields,
} from './fields';
import { searchStore } from './searchStore';
import { useSearchDeps } from './SearchDepsContext';
import { useHashRoute } from './useHashRoute';
import {
  useReferenceData,
  useSearchActions,
  useSearchInit,
} from './useSearchController';

const TAB_LABEL: Record<
  SearchTab,
  'search.tab.byClass' | 'search.tab.bySubjectId' | 'search.tab.byCategory'
> = {
  by_class: 'search.tab.byClass',
  by_subject_id: 'search.tab.bySubjectId',
  by_subject_owner_id: 'search.tab.byCategory',
};

export function SearchForm() {
  const deps = useSearchDeps();
  const route = useHashRoute();
  const reloadReference = useReferenceData(deps.send);
  useSearchInit(deps.repo, route);
  const { submit } = useSearchActions(deps);
  const { t, language } = useTranslation();

  const activeTab = useStore(searchStore, (state) => state.activeTab);
  const byClass = useStore(searchStore, (state) => state.byClass);
  const bySubjectId = useStore(searchStore, (state) => state.bySubjectId);
  const byCategory = useStore(searchStore, (state) => state.byCategory);
  const faculties = useStore(searchStore, (state) => state.faculties);
  const departments = useStore(searchStore, (state) => state.departments);
  const curricula = useStore(searchStore, (state) => state.curricula);
  const subjectOwners = useStore(searchStore, (state) => state.subjectOwners);

  const years = useMemo(
    () => buddhistYears(toBuddhistYear(new Date().getFullYear())),
    [],
  );

  const reference = { faculties, departments, curricula, subjectOwners };
  // The subject id tab uses no reference selects, so a reference load failure is
  // irrelevant there and its banner would be noise.
  const referenceError =
    activeTab !== 'by_subject_id' &&
    (faculties.status === 'error' ||
      departments.status === 'error' ||
      curricula.status === 'error' ||
      subjectOwners.status === 'error');

  const query = buildTeachTableQueryForTab(activeTab, {
    byClass,
    bySubjectId,
    byCategory,
  });

  // A value longer than eight digits can only arrive from a persisted or imported
  // search, so it shows the safety net message at once; a short value shows the
  // message only after a submit or Enter attempt, so the counter guides while the
  // student types rather than nagging.
  const subjectIdRef = useRef<HTMLInputElement>(null);
  const [subjectIdAttempted, setSubjectIdAttempted] = useState(false);
  const subjectIdOutOfRange = bySubjectId.subjectId.length > 8;
  const subjectIdShowMessage =
    subjectIdOutOfRange ||
    (subjectIdAttempted && !isValidSubjectId(bySubjectId.subjectId));

  // The subject id submit stays enabled while the id is incomplete so a click or
  // Enter routes to the inline message and focuses the field rather than a dead
  // disabled control; the other tabs disable until their form is ready.
  const submitDisabled =
    activeTab === 'by_subject_id' ? bySubjectId.year === '' : query === null;

  const handleSubmit = () => {
    if (
      activeTab === 'by_subject_id' &&
      !isValidSubjectId(bySubjectId.subjectId)
    ) {
      setSubjectIdAttempted(true);
      subjectIdRef.current?.focus();
      return;
    }
    void submit();
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div
        role="group"
        aria-label={t('search.emptyTitle')}
        className="flex gap-1 rounded-kcp bg-surface-alt p-1"
      >
        {SEARCH_TABS.map((tab) => {
          const selected = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                searchStore.getState().setActiveTab(tab);
              }}
              className={`flex-1 rounded-[6px] px-2 py-1.5 text-xs font-medium ${FOCUS_RING} ${
                selected
                  ? 'bg-surface text-primary-strong shadow-kcp'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t(TAB_LABEL[tab])}
            </button>
          );
        })}
      </div>

      {referenceError ? (
        <div className="flex flex-col gap-2 rounded-kcp border border-border bg-surface-alt p-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-ink">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden />
            {t('search.referenceErrorTitle')}
          </span>
          <span className="text-ink-soft">
            {t('search.referenceErrorBody')}
          </span>
          <button
            type="button"
            onClick={reloadReference}
            className={`self-start rounded-kcp bg-primary-strong px-3 py-1.5 text-xs font-medium text-surface hover:bg-primary-hover ${FOCUS_OUTLINE}`}
          >
            {t('action.retry')}
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 kcp-scroll overflow-y-auto">
        {activeTab === 'by_class' ? (
          <ClassFields
            form={byClass}
            reference={reference}
            years={years}
            locale={language}
            t={t}
            patch={(patch) => {
              searchStore.getState().patchClassForm(patch);
            }}
          />
        ) : null}
        {activeTab === 'by_subject_id' ? (
          <>
            <TermFields
              year={bySubjectId.year}
              semester={bySubjectId.semester}
              years={years}
              t={t}
              onYear={(year) => {
                searchStore.getState().patchSubjectIdForm({ year });
              }}
              onSemester={(value) => {
                const semester = asSemester(value);
                if (semester !== null) {
                  searchStore.getState().patchSubjectIdForm({ semester });
                }
              }}
            />
            <SubjectIdInput
              label={t('search.subjectId')}
              value={bySubjectId.subjectId}
              hint={t('search.subjectIdHint')}
              invalid={subjectIdShowMessage}
              invalidMessage={t('search.subjectIdInvalid')}
              inputRef={subjectIdRef}
              onChange={(subjectId) => {
                searchStore.getState().patchSubjectIdForm({ subjectId });
                setSubjectIdAttempted(false);
              }}
              onSubmit={handleSubmit}
            />
          </>
        ) : null}
        {activeTab === 'by_subject_owner_id' ? (
          <CategoryFields
            form={byCategory}
            reference={reference}
            years={years}
            locale={language}
            t={t}
            patch={(patch) => {
              searchStore.getState().patchCategoryForm(patch);
            }}
          />
        ) : null}
      </div>

      <button
        type="button"
        disabled={submitDisabled}
        onClick={handleSubmit}
        className={`rounded-kcp bg-primary-strong px-4 py-2 text-sm font-medium text-surface hover:bg-primary-hover disabled:opacity-50 ${FOCUS_OUTLINE}`}
      >
        {t('search.submit')}
      </button>
    </div>
  );
}
