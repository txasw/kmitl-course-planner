// Which catalog course cards are open. A card starts collapsed, and a student's
// choice to open or close it holds for the query that produced the result, so a
// refresh of the same search keeps it while a new search starts clean. Each choice
// is tagged with whether the course was in the plan when it was made: a choice made
// before an add does not carry over to the added card, and once the tag no longer
// matches the choice is dropped, so the card is collapsed again after a remove.

export interface CardChoice {
  open: boolean;
  added: boolean;
}

export interface CardDisclosure {
  queryKey: string | null;
  choices: Readonly<Record<string, CardChoice>>;
}

export const EMPTY_DISCLOSURE: CardDisclosure = {
  queryKey: null,
  choices: {},
};

type QueryFields = Readonly<Record<string, string | boolean | undefined>>;

/** A stable key for a search query: its JSON with the keys sorted, or null. */
export function catalogQueryKey(query: QueryFields | null): string | null {
  if (query === null) return null;
  const sorted = Object.keys(query)
    .sort()
    .map((key) => [key, query[key]]);
  return JSON.stringify(sorted);
}

/** Records a choice for one card, dropping every choice of an earlier query. */
export function withChoice(
  disclosure: CardDisclosure,
  queryKey: string | null,
  subjectId: string,
  choice: CardChoice,
): CardDisclosure {
  const base = disclosure.queryKey === queryKey ? disclosure.choices : {};
  return {
    queryKey,
    choices: { ...base, [subjectId]: choice },
  };
}

/**
 * Drops the choices whose placement tag no longer matches the plan. It returns the
 * same object when nothing changes, so a store update can be skipped.
 */
export function withPlacement(
  disclosure: CardDisclosure,
  addedIds: ReadonlySet<string>,
): CardDisclosure {
  const entries = Object.entries(disclosure.choices);
  const kept = entries.filter(
    ([subjectId, choice]) => choice.added === addedIds.has(subjectId),
  );
  if (kept.length === entries.length) return disclosure;
  return { ...disclosure, choices: Object.fromEntries(kept) };
}

/**
 * Whether a card is open. A stored choice applies only for the same query and the
 * same placement; otherwise an unadded card opens when the catalog auto opens it.
 */
export function isCardOpen(
  disclosure: CardDisclosure,
  queryKey: string | null,
  subjectId: string,
  added: boolean,
  autoOpen: boolean,
): boolean {
  const choice =
    disclosure.queryKey === queryKey
      ? disclosure.choices[subjectId]
      : undefined;
  if (choice?.added === added) return choice.open;
  return autoOpen && !added;
}
