// Which subject type headings of the catalog are collapsed. Every heading starts
// expanded, and a student's choice to collapse one holds for the query that produced
// the result, like the card disclosure, so a refresh of the same search keeps it
// while a new search starts with every heading open and never hides its only result.

import type { Course } from '../domain/types';

export interface GroupCollapse {
  queryKey: string | null;
  /** The keys of the collapsed headings for that query. */
  collapsed: readonly string[];
}

export const EMPTY_GROUP_COLLAPSE: GroupCollapse = {
  queryKey: null,
  collapsed: [],
};

/**
 * The key of the heading a course sits under, one place for the grouping and the
 * collapse to agree on. It is the Thai name, so a language switch keeps the groups.
 */
export function courseGroupKey(course: Course): string {
  return course.groupNameTh;
}

/** Whether the heading is collapsed for the current query. */
export function isGroupCollapsed(
  state: GroupCollapse,
  queryKey: string | null,
  groupKey: string,
): boolean {
  return state.queryKey === queryKey && state.collapsed.includes(groupKey);
}

/** The state with one heading collapsed or expanded, starting clean on a new query. */
export function withGroupCollapsed(
  state: GroupCollapse,
  queryKey: string | null,
  groupKey: string,
  collapsed: boolean,
): GroupCollapse {
  const current = state.queryKey === queryKey ? state.collapsed : [];
  const rest = current.filter((key) => key !== groupKey);
  return { queryKey, collapsed: collapsed ? [...rest, groupKey] : rest };
}
