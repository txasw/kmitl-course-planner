// The search rail: a tab bar over the three official search modes, the active
// tab's fields, and a submit that streams results into the catalog. Reference
// data loads once on mount; the term seeds from a persisted search or the host
// route. The four async surfaces each render a deliberate state.

import { useMemo } from 'react';
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
  const subjectIdInvalid =
    bySubjectId.subjectId !== '' && !isValidSubjectId(bySubjectId.subjectId);

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
              invalid={subjectIdInvalid}
              invalidMessage={t('search.subjectIdInvalid')}
              onChange={(subjectId) => {
                searchStore.getState().patchSubjectIdForm({ subjectId });
              }}
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
        disabled={query === null}
        onClick={() => {
          void submit();
        }}
        className={`rounded-kcp bg-primary-strong px-4 py-2 text-sm font-medium text-surface hover:bg-primary-hover disabled:opacity-50 ${FOCUS_OUTLINE}`}
      >
        {t('search.submit')}
      </button>
    </div>
  );
}
