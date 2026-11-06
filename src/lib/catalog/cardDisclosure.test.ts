import { describe, it, expect } from 'vitest';
import {
  EMPTY_DISCLOSURE,
  catalogQueryKey,
  isCardInstant,
  isCardOpen,
  withAllCards,
  withChoice,
  withPlacement,
  type CardChoice,
} from './cardDisclosure';

const OPEN_UNADDED: CardChoice = { open: true, added: false };

describe('catalogQueryKey', () => {
  it('is null without a query', () => {
    expect(catalogQueryKey(null)).toBeNull();
  });

  it('is stable across key order and changes with a value', () => {
    const a = catalogQueryKey({ mode: 'by_subject_id', selected_year: '2569' });
    const b = catalogQueryKey({ selected_year: '2569', mode: 'by_subject_id' });
    expect(a).toBe(b);
    expect(
      catalogQueryKey({ mode: 'by_subject_id', selected_year: '2570' }),
    ).not.toBe(a);
  });
});

describe('withChoice', () => {
  it('keeps the choices of the same query', () => {
    const first = withChoice(EMPTY_DISCLOSURE, 'q1', 'S1', OPEN_UNADDED);
    const second = withChoice(first, 'q1', 'S2', OPEN_UNADDED);
    expect(Object.keys(second.choices)).toEqual(['S1', 'S2']);
  });

  it('drops the choices of an earlier query', () => {
    const first = withChoice(EMPTY_DISCLOSURE, 'q1', 'S1', OPEN_UNADDED);
    const second = withChoice(first, 'q2', 'S2', OPEN_UNADDED);
    expect(second.queryKey).toBe('q2');
    expect(Object.keys(second.choices)).toEqual(['S2']);
  });
});

describe('isCardOpen', () => {
  const opened = withChoice(EMPTY_DISCLOSURE, 'q1', 'S1', OPEN_UNADDED);

  it('honours a choice for the same query and placement', () => {
    expect(isCardOpen(opened, 'q1', 'S1', false, false)).toBe(true);
    const closed = withChoice(opened, 'q1', 'S1', {
      open: false,
      added: false,
    });
    expect(isCardOpen(closed, 'q1', 'S1', false, true)).toBe(false);
  });

  it('ignores a choice from another query', () => {
    expect(isCardOpen(opened, 'q2', 'S1', false, false)).toBe(false);
  });

  it('ignores a choice tagged unadded once the course is added', () => {
    expect(isCardOpen(opened, 'q1', 'S1', true, false)).toBe(false);
  });

  it('auto opens only an unadded card', () => {
    expect(isCardOpen(EMPTY_DISCLOSURE, 'q1', 'S1', false, true)).toBe(true);
    expect(isCardOpen(EMPTY_DISCLOSURE, 'q1', 'S1', true, true)).toBe(false);
  });
});

describe('withPlacement', () => {
  it('returns the same object when every tag matches', () => {
    const opened = withChoice(EMPTY_DISCLOSURE, 'q1', 'S1', OPEN_UNADDED);
    expect(withPlacement(opened, new Set())).toBe(opened);
  });

  it('drops a choice once its course is added, so a remove collapses it', () => {
    const opened = withChoice(EMPTY_DISCLOSURE, 'q1', 'S1', OPEN_UNADDED);
    const added = withPlacement(opened, new Set(['S1']));
    expect(added.choices).toEqual({});
    expect(isCardOpen(added, 'q1', 'S1', false, false)).toBe(false);
  });
});

describe('withAllCards', () => {
  const cards = [
    { subjectId: 'S1', added: false },
    { subjectId: 'S2', added: true },
  ];

  it('sets every given card with its placement tag and marks the change bulk', () => {
    const all = withAllCards(EMPTY_DISCLOSURE, 'q1', cards, true);
    expect(isCardInstant(all, 'q1', 'S1')).toBe(true);
    expect(isCardInstant(all, 'q1', 'S2')).toBe(true);
    expect(isCardInstant(all, 'q2', 'S1')).toBe(false);
    expect(isCardOpen(all, 'q1', 'S1', false, false)).toBe(true);
    expect(isCardOpen(all, 'q1', 'S2', true, false)).toBe(true);
  });

  it('keeps the choices of cards outside the list for the same query', () => {
    const hidden = withChoice(EMPTY_DISCLOSURE, 'q1', 'S3', OPEN_UNADDED);
    const all = withAllCards(hidden, 'q1', cards, false);
    expect(isCardOpen(all, 'q1', 'S3', false, false)).toBe(true);
    expect(isCardOpen(all, 'q1', 'S1', false, true)).toBe(false);
  });

  it('drops the choices of an earlier query', () => {
    const earlier = withChoice(EMPTY_DISCLOSURE, 'q0', 'S3', OPEN_UNADDED);
    const all = withAllCards(earlier, 'q1', cards, true);
    expect(Object.keys(all.choices)).toEqual(['S1', 'S2']);
  });

  it('clears the bulk flag of only the card a single choice names', () => {
    const all = withAllCards(EMPTY_DISCLOSURE, 'q1', cards, true);
    const single = withChoice(all, 'q1', 'S1', {
      ...OPEN_UNADDED,
      bulk: true,
    });
    expect(isCardInstant(single, 'q1', 'S1')).toBe(false);
    expect(isCardInstant(single, 'q1', 'S2')).toBe(true);
    expect(single.choices.S2).toBe(all.choices.S2);
  });
});
