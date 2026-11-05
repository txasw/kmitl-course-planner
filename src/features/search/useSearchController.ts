// The search hooks that talk to the worker. useReferenceData fetches the four
// reference lists once, coalescing on their status so reopening the overlay does
// not refetch, and returns a reload for the error retry path. useSearchInit
// hydrates a persisted search and seeds the term from the first source that has
// one: the teach table route captured at mount, the persisted search, the active
// plan, then the term after the registrar's current term. That last source needs a
// fetch, so the form renders with the local fallback first and takes the fetched
// default only if nothing else has set the term by then. A later host navigation
// never clobbers an in session edit. useSearchActions builds the active tab query, runs it
// guarded against a superseded response, and persists the last search. The stores
// are plain objects, so writing to them after unmount is safe and needs no
// cancellation guard; the query guard exists only to drop a stale response.

import { useCallback, useEffect, useRef } from 'react';
import { buildTeachTableQueryForTab, termForTab } from '@/lib/search/formState';
import {
  buddhistYears,
  resolveInitialTerm,
  termFromQueryFields,
  toBuddhistYear,
  type Term,
} from '@/lib/routing/academicTerms';
import { toCurrentTerm } from '@/lib/domain/schemas';
import type { TeachTableRoute } from '@/lib/routing/parseTeachTableRoute';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { AsyncState } from '@/lib/utils/async';
import type { Result } from '@/lib/utils/result';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from './searchStore';
import type { SearchDeps } from './SearchDepsContext';

function loadInto<T>(
  fetcher: () => Promise<Result<T>>,
  setState: (state: AsyncState<T>) => void,
): void {
  setState({ status: 'loading' });
  void fetcher().then((result) => {
    setState(
      result.ok
        ? { status: 'ready', data: result.value }
        : { status: 'error', error: result.error },
    );
  });
}

export function useReferenceData(send: TypedSend): () => void {
  const loadAll = useCallback(
    (onlyIdle: boolean) => {
      const state = searchStore.getState();
      if (!onlyIdle || state.faculties.status === 'idle') {
        loadInto(() => send({ type: 'ref/faculty' }), state.setFaculties);
      }
      if (!onlyIdle || state.departments.status === 'idle') {
        loadInto(() => send({ type: 'ref/department' }), state.setDepartments);
      }
      if (!onlyIdle || state.curricula.status === 'idle') {
        loadInto(() => send({ type: 'ref/curriculum' }), state.setCurricula);
      }
      if (!onlyIdle || state.subjectOwners.status === 'idle') {
        loadInto(
          () => send({ type: 'ref/subjectOwner' }),
          state.setSubjectOwners,
        );
      }
    },
    [send],
  );

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  return () => {
    loadAll(false);
  };
}

/** The active plan's term, read when needed because plans hydrate on their own. */
function activePlanTerm(): Term | null {
  const { plans, activePlanId } = planStore.getState();
  const active = plans.find((plan) => plan.id === activePlanId);
  return active === undefined
    ? null
    : { year: active.year, semester: active.semester };
}

export function useSearchInit(
  { repo, send }: SearchDeps,
  route: TeachTableRoute | null,
): void {
  // The route is captured at first render so a later host navigation does not
  // reseed a form the student may already be editing.
  const initialRoute = useRef(route);
  useEffect(() => {
    // Seed or hydrate exactly once per page session. The overlay unmounts and
    // remounts the form on close and open, so guarding on a store flag rather
    // than an effect dependency keeps a remount from clobbering in session
    // edits. The flag is claimed synchronously so a rapid reopen cannot start a
    // second load, and the store writes apply unconditionally because writing to
    // the plain store after unmount is safe.
    if (searchStore.getState().hasInitialized) {
      return;
    }
    searchStore.getState().setInitialized(true);
    void repo.load().then((persisted) => {
      if (persisted) {
        searchStore.getState().hydrate(persisted);
      }
      const persistedTerm =
        persisted === null ? null : termForTab(persisted.activeTab, persisted);
      const sources = {
        route: initialRoute.current,
        persisted:
          persistedTerm === null
            ? null
            : termFromQueryFields(persistedTerm.year, persistedTerm.semester),
        years: buddhistYears(toBuddhistYear(new Date().getFullYear())),
      };
      const initial = resolveInitialTerm({
        ...sources,
        plan: activePlanTerm(),
        current: null,
      });
      // The hydrated forms already carry their own per tab terms.
      if (initial.source === 'persisted') {
        return;
      }
      if (initial.source !== 'fallback') {
        searchStore.getState().seedTerm(initial.term);
        return;
      }
      searchStore.getState().seedFallbackTerm(initial.term);
      void send({ type: 'ref/currentTerm' }).then((result) => {
        // A failed fetch keeps the fallback the form already shows.
        if (!result.ok) {
          return;
        }
        // The plan is read again because plans may have hydrated meanwhile.
        const resolved = resolveInitialTerm({
          ...sources,
          plan: activePlanTerm(),
          current: toCurrentTerm(result.value),
        });
        searchStore.getState().applyDefaultTerm(resolved.term);
      });
    });
  }, [repo, send]);
}

/** Outcome of a manual refresh, so the caller can confirm a no op refresh. */
export type RefreshOutcome = 'changed' | 'unchanged' | 'error';

export interface SearchActions {
  submit: () => Promise<void>;
  retry: () => Promise<void>;
  refreshResult: () => Promise<RefreshOutcome>;
  cancel: () => Promise<void>;
}

export function useSearchActions({ send, repo }: SearchDeps): SearchActions {
  const runQuery = useCallback(
    async (query: TeachTableQuery, refresh = false) => {
      searchStore.getState().setResult({ status: 'loading' }, query);
      const result = await send({ type: 'teachTable/query', query, refresh });
      // A newer submission replaces resultQuery, so a stale response is dropped.
      if (searchStore.getState().resultQuery !== query) {
        return;
      }
      searchStore
        .getState()
        .setResult(
          result.ok
            ? { status: 'ready', data: result.value }
            : { status: 'error', error: result.error },
          query,
        );
    },
    [send],
  );

  const submit = useCallback(async () => {
    const state = searchStore.getState();
    const query = buildTeachTableQueryForTab(state.activeTab, {
      byClass: state.byClass,
      bySubjectId: state.bySubjectId,
      byCategory: state.byCategory,
    });
    if (query === null) {
      return;
    }
    void repo.save({
      schemaVersion: 1,
      activeTab: state.activeTab,
      byClass: state.byClass,
      bySubjectId: state.bySubjectId,
      byCategory: state.byCategory,
    });
    await runQuery(query);
  }, [runQuery, repo]);

  const retry = useCallback(async () => {
    const { resultQuery } = searchStore.getState();
    if (resultQuery === null) {
      return;
    }
    await runQuery(resultQuery);
  }, [runQuery]);

  // Re run the current query while bypassing the cache, so the catalog reflects
  // the latest seats and closures on demand without waiting for the ttl. Report
  // whether the fresh result changed, so a no op refresh can be confirmed to the
  // user, who would otherwise see no visible change.
  const refreshResult = useCallback(async (): Promise<RefreshOutcome> => {
    const before = searchStore.getState().result;
    const { resultQuery } = searchStore.getState();
    if (resultQuery === null) {
      return 'error';
    }
    await runQuery(resultQuery, true);
    // A newer search may have superseded the refresh; comparing against a foreign
    // query's result would toast a misleading outcome, so bail if it did.
    if (searchStore.getState().resultQuery !== resultQuery) {
      return 'error';
    }
    const after = searchStore.getState().result;
    if (after.status !== 'ready') {
      return 'error';
    }
    if (
      before.status === 'ready' &&
      JSON.stringify(before.data.courses) === JSON.stringify(after.data.courses)
    ) {
      return 'unchanged';
    }
    return 'changed';
  }, [runQuery]);

  // Abort a slow in flight query in the worker and return the form to idle. The
  // pending runQuery response is dropped because resultQuery no longer matches it.
  const cancel = useCallback(async () => {
    const { resultQuery } = searchStore.getState();
    if (resultQuery === null) {
      return;
    }
    searchStore.getState().setResult({ status: 'idle' }, null);
    await send({ type: 'teachTable/cancel', query: resultQuery });
  }, [send]);

  return { submit, retry, refreshResult, cancel };
}
