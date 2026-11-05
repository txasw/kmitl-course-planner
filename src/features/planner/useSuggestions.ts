// Runs the plan suggestion search for the suggestion dialog. The first search runs as
// soon as the dialog opens; a later change of the objective, the preference, the result,
// or the plan waits a short debounce so a quick run of chip presses searches once. The
// last finished result stays on screen while a new one is pending, and the hook reports
// busy only once the wait has outlasted a frame, so a search that settles at once never
// flashes a loading state. The search itself is synchronous and bounded by its node cap.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Course } from '@/lib/domain/types';
import {
  suggestPlans,
  type SuggestInput,
  type SuggestResult,
} from '@/lib/planner/suggest';
import type { SuggestObjective } from '@/lib/planner/suggestRank';
import type { SuggestPreference } from '@/lib/planner/suggestScore';

/** How long an option change waits for the next one before searching. */
export const SUGGEST_DEBOUNCE_MS = 120;

export interface SuggestionsState {
  /** The latest finished result, or null before the first search finishes. */
  result: SuggestResult | null;
  /** Whether a search for the current inputs has been pending longer than a frame. */
  busy: boolean;
}

export function useSuggestions(
  courses: readonly Course[],
  locked: readonly PlanEntry[],
  objective: SuggestObjective,
  preference: SuggestPreference,
): SuggestionsState {
  const input = useMemo<SuggestInput>(
    () => ({ courses, locked, objective, preference }),
    [courses, locked, objective, preference],
  );
  const [finished, setFinished] = useState<{
    input: SuggestInput;
    result: SuggestResult;
  } | null>(null);
  const [waited, setWaited] = useState<SuggestInput | null>(null);
  const searched = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setWaited(input);
    });
    const timer = setTimeout(
      () => {
        searched.current = true;
        setFinished({ input, result: suggestPlans(input) });
      },
      searched.current ? SUGGEST_DEBOUNCE_MS : 0,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [input]);

  return {
    result: finished?.result ?? null,
    busy: finished?.input !== input && waited === input,
  };
}
