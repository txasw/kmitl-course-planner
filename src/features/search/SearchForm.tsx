// The search form at the head of the catalog column: the term row every tab shares,
// a tablist over the three official search modes, the active tab's fields, and a
// submit directly under the last field that streams results into the catalog below.
// The search header around it owns the fold and the scroller, so the form lays out at
// its natural height. Reference data loads once on mount; the term seeds from the host
// route, a persisted search, the active plan, or the term after the registrar's current
// one. The four async surfaces each render a deliberate state. Focus within the form is
// tracked, so the updates dialog never opens on its own while the student types a search.

import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { buddhistYears, toBuddhistYear } from '@/lib/routing/academicTerms';
import {
  buildTeachTableQueryForTab,
  isValidSubjectId,
  missingField,
} from '@/lib/search/formState';
import { useSearchFocusTracking } from '@/features/shell/attentionStore';
import { commitAndFocus } from '@/features/shell/commitAndFocus';
import { useTranslation } from '@/features/shell/useTranslation';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import {
  CategoryFields,
  ClassFields,
  SubjectIdInput,
  TermFields,
} from './fields';
import { SEARCH_BAR_ID, SEARCH_TABPANEL_ID, searchTabId } from './searchIds';
import { searchStore } from './searchStore';
import { SearchSubmit, missingFieldReason } from './SearchSubmit';
import { SearchTabList } from './SearchTabList';
import { useSearchDeps } from './SearchDepsContext';
import { useHashRoute } from './useHashRoute';
import {
  useReferenceData,
  useSearchActions,
  useSearchInit,
} from './useSearchController';

export function SearchForm() {
  const deps = useSearchDeps();
  const route = useHashRoute();
  const reloadReference = useReferenceData(deps.send);
  useSearchInit(deps, route);
  const { submit } = useSearchActions(deps);
  const { t, language } = useTranslation();
  const focusTracking = useSearchFocusTracking();

  const activeTab = useStore(searchStore, (state) => state.activeTab);
  const term = useStore(searchStore, (state) => state.term);
  const byClass = useStore(searchStore, (state) => state.byClass);
  const bySubjectId = useStore(searchStore, (state) => state.bySubjectId);
  const byCategory = useStore(searchStore, (state) => state.byCategory);
  const faculties = useStore(searchStore, (state) => state.faculties);
  const departments = useStore(searchStore, (state) => state.departments);
  const curricula = useStore(searchStore, (state) => state.curricula);
  const subjectOwners = useStore(searchStore, (state) => state.subjectOwners);
  const busy = useStore(
    searchStore,
    (state) => state.result.status === 'loading',
  );

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

  const forms = { byClass, bySubjectId, byCategory };
  const query = buildTeachTableQueryForTab(activeTab, term, forms);

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

  // The subject id submit stays live while the id is incomplete so a click or Enter
  // routes to the inline message and focuses the field rather than a dead control; any
  // other missing field blocks the submit and names itself under it. A query in
  // flight blocks it too: the form is folded then, so this shows only when the
  // student reopens it mid search, and the slow notice offers the way out.
  const submitReason = busy
    ? t('search.busyReason')
    : missingFieldReason(missingField(activeTab, term, forms), t);

  // An accepted search folds this form and turns it inert, so focus moves from the
  // pressed control to the summary bar in the same commit. The bar is not a button, so
  // a repeated Enter there starts nothing.
  const handleSubmit = (from: Element) => {
    if (busy) {
      return;
    }
    if (
      activeTab === 'by_subject_id' &&
      !isValidSubjectId(bySubjectId.subjectId)
    ) {
      setSubjectIdAttempted(true);
      subjectIdRef.current?.focus();
      return;
    }
    if (query === null) {
      return;
    }
    commitAndFocus(from, SEARCH_BAR_ID, () => {
      void submit();
    });
  };

  return (
    <div className="flex flex-col gap-4" {...focusTracking}>
      <TermFields
        term={term}
        years={years}
        t={t}
        onChange={(patch) => {
          searchStore.getState().patchTerm(patch);
        }}
      />

      <SearchTabList
        activeTab={activeTab}
        label={t('search.emptyTitle')}
        t={t}
        onSelect={(tab) => {
          searchStore.getState().setActiveTab(tab);
        }}
      />

      <div
        id={SEARCH_TABPANEL_ID}
        role="tabpanel"
        aria-labelledby={searchTabId(activeTab)}
        className="flex flex-col gap-4"
      >
        {referenceError ? (
          <div className="flex flex-col gap-2 rounded-kcp border border-border bg-surface-alt p-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <AlertTriangle size={16} strokeWidth={2} aria-hidden />
              {t('search.referenceErrorTitle')}
            </span>
            <span className="text-ink-soft">
              {t('search.referenceErrorBody')}
            </span>
            <button
              type="button"
              onClick={reloadReference}
              className={`self-start rounded-kcp bg-primary-strong px-3 py-1.5 text-xs font-semibold text-surface hover:bg-primary-hover ${FOCUS_OUTLINE}`}
            >
              {t('action.retry')}
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {activeTab === 'by_class' ? (
            <ClassFields
              form={byClass}
              reference={reference}
              locale={language}
              t={t}
              patch={(patch) => {
                searchStore.getState().patchClassForm(patch);
              }}
            />
          ) : null}
          {activeTab === 'by_subject_id' ? (
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
          ) : null}
          {activeTab === 'by_subject_owner_id' ? (
            <CategoryFields
              form={byCategory}
              reference={reference}
              locale={language}
              t={t}
              patch={(patch) => {
                searchStore.getState().patchCategoryForm(patch);
              }}
            />
          ) : null}
          <SearchSubmit reason={submitReason} t={t} onSubmit={handleSubmit} />
          <button
            type="button"
            onClick={() => {
              searchStore.getState().clearActiveForm();
              setSubjectIdAttempted(false);
            }}
            className={`inline-flex min-h-6 items-center gap-1 self-center rounded-kcp px-2 text-sm text-ink-soft hover:text-ink pointer-coarse:min-h-11 ${FOCUS_RING}`}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden />
            {t('search.clear')}
          </button>
        </div>
      </div>
    </div>
  );
}
