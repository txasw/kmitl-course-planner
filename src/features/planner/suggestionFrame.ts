// The sections and the grid frame the plan suggestion cards draw. A card shows the whole
// week its suggestion would produce, the plan subjects it keeps included, so its sections
// are every chosen section and its pair: a plan subject kept at its own group as the plan
// stores it, with its verification status, and every other one shaped exactly as an add
// would store it. The cards share one frame, the smart window and the
// visible days over every card's meetings together, so the same hour and the same day sit
// at the same place on each card and the cards read as a comparison.

import type { PlanEntry } from '@/lib/domain/plan';
import type { DayOfWeek } from '@/lib/parsing/days';
import {
  computeSmartWindow,
  smartVisibleDays,
  type GridWindow,
} from '@/lib/planner/grid';
import type { Suggestion } from '@/lib/planner/suggest';
import { toSnapshot } from '@/lib/planner/transaction';
import { toPlacedSection, type PlacedSection } from './placedSection';

export interface SuggestionFrame {
  window: GridWindow;
  days: readonly DayOfWeek[];
}

export function suggestionSections(
  entries: readonly PlanEntry[],
  suggestion: Suggestion,
): PlacedSection[] {
  const byId = new Map(entries.map((entry) => [entry.teachTableId, entry]));
  return suggestion.choices.flatMap((choice) =>
    choice.group.map((member) => {
      const entry = choice.current ? byId.get(member.teachTableId) : undefined;
      return entry === undefined
        ? toPlacedSection(toSnapshot(choice.course, member))
        : toPlacedSection(entry.snapshot, entry.verifyStatus);
    }),
  );
}

export function sharedFrame(
  cards: readonly (readonly PlacedSection[])[],
): SuggestionFrame {
  const meetings = cards.flat().flatMap((section) => section.meetings);
  return {
    window: computeSmartWindow(meetings),
    days: smartVisibleDays(meetings),
  };
}
