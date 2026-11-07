// The search hooks that talk to the worker. useReferenceData fetches the four
// reference lists once, coalescing on their status so reopening the overlay does
// not refetch, and returns a reload for the error retry path. useSearchBoot starts
// loading the persisted search when the app mounts, so it is ready by the first open.
// useSearchInit, at that open, applies it and seeds the term from the first source
// that has one: the teach table route captured then, the persisted search, the active
// plan, then the term after the registrar's current term. That last source needs a
// fetch, so the form renders with the local fallback first and takes the fetched
// default only if nothing else has set the term and no search has run under it by
// then. A later host navigation never clobbers an in session edit. useSearchActions
// builds the active tab query, runs it guarded against a superseded response, and
// persists the last search. A submit and a rerun run with the user intent, which folds
// the form into the bar; retry and refresh run in the background and leave the
// disclosure as the student set it. The stores are plain objects, so writing to them
// after unmount is safe and needs no cancellation guard; the query guard exists only
// to drop a stale response.

import { useCallback, useEffect, useRef } from 'react';
import { buildTeachTableQueryForTab } from '@/lib/search/formState';
import {
  buddhistYears,
  resolveInitialTerm,
  termFromQueryFields,
  toBuddhistYear,
} from '@/lib/routing/academicTerms';
import { toCurrentTerm } from '@/lib/domain/schemas';
import type { TeachTableRoute } from '@/lib/routing/parseTeachTableRoute';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import type { AsyncState } from '@/lib/utils/async';
import type { Result } from '@/lib/utils/result';
import { activePlanTerm } from '@/features/plans/planStore';
import { searchStore, type QueryIntent } from './searchStore';
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

/** Start loading the persisted search at mount, ahead of the first open. */
export function useSearchBoot({ repo }: Pick<SearchDeps, 'repo'>): void {
  useEffect(() => {
    searchStore.getState().bootSearch(repo);
  }, [repo]);
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
    const load = searchStore.getState().claimInitialization(repo);
    if (load === null) {
      return;
    }
    void load.then((persisted) => {
      const sources = {
        route: initialRoute.current,
        persisted:
          persisted === null
            ? null
            : termFromQueryFields(persisted.term.year, persisted.term.semester),
        years: buddhistYears(toBuddhistYear(new Date().getFullYear())),
      };
      const initial = resolveInitialTerm({
        ...sources,
        plan: activePlanTerm(),
        current: null,
      });
      // One write lands the forms, the term and any restored bar, so the head paints
      // the bar or the form once rather than one and then the other.
      searchStore.getState().seedSearch(persisted, initial);
      if (initial.source !== 'fallback') {
        return;
      }
      void send({ type: 'ref/currentTerm' }).then((result) => {
        // The plan is read again because plans may have hydrated meanwhile. A failed
        // fetch resolves without a current term, so the term settles on that plan or
        // on the fallback the form already shows and is no longer pending.
        const resolved = resolveInitialTerm({
          ...sources,
          plan: activePlanTerm(),
          current: result.ok ? toCurrentTerm(result.value) : null,
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
  rerun: () => Promise<void>;
  retry: () => Promise<void>;
  refreshResult: () => Promise<RefreshOutcome>;
  cancel: () => Promise<void>;
}

interface RunOptions {
  intent: QueryIntent;
  refresh?: boolean;
}

export function useSearchActions({ send, repo }: SearchDeps): SearchActions {
  // The store write runs before the first await, so a caller that commits a submit
  // under flushSync sees the folded form and the bar in the same frame.
  const runQuery = useCallback(
    async (query: TeachTableQuery, { intent, refresh = false }: RunOptions) => {
      searchStore.getState().startQuery(query, intent);
      const result = await send({ type: 'teachTable/query', query, refresh });
      // A newer submission replaces resultQuery, so a stale response is dropped.
      if (searchStore.getState().resultQuery !== query) {
        return;
      }
      const { setResult } = searchStore.getState();
      if (result.ok) {
        setResult(
          { status: 'ready', data: result.value.catalog },
          query,
          result.value.fetchedAt,
        );
      } else {
        setResult({ status: 'error', error: result.error }, query);
      }
    },
    [send],
  );

  const submit = useCallback(async () => {
    const state = searchStore.getState();
    const query = buildTeachTableQueryForTab(state.activeTab, state.term, {
      byClass: state.byClass,
      bySubjectId: state.bySubjectId,
      byCategory: state.byCategory,
    });
    if (query === null) {
      return;
    }
    void repo.save({
      schemaVersion: 2,
      activeTab: state.activeTab,
      term: state.term,
      byClass: state.byClass,
      bySubjectId: state.bySubjectId,
      byCategory: state.byCategory,
    });
    await runQuery(query, { intent: 'user' });
  }, [runQuery, repo]);

  // Run the search the bar names again as the student's own search. After a reload the
  // bar is restored with no result; the worker cache answers while it is still valid.
  const rerun = useCallback(async () => {
    const { barQuery } = searchStore.getState();
    if (barQuery === null) {
      return;
    }
    await runQuery(barQuery, { intent: 'user' });
  }, [runQuery]);

  const retry = useCallback(async () => {
    const { resultQuery } = searchStore.getState();
    if (resultQuery === null) {
      return;
    }
    await runQuery(resultQuery, { intent: 'background' });
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
    await runQuery(resultQuery, { intent: 'background', refresh: true });
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

  // Abort a slow in flight query in the worker and return to the open form. The
  // pending runQuery response is dropped because resultQuery no longer matches it.
  const cancel = useCallback(async () => {
    const { resultQuery, cancelSearch } = searchStore.getState();
    if (resultQuery === null) {
      return;
    }
    cancelSearch();
    await send({ type: 'teachTable/cancel', query: resultQuery });
  }, [send]);

  return { submit, rerun, retry, refreshResult, cancel };
}
