// The text of a term switch action. It reads the plan store so the label says open
// when the term already has a plan and create when the action would make one; it is
// its own component so a row reads the store only while it shows the action.

import type { Translate } from '@/lib/i18n/t';
import { termSwitchLabel } from '@/lib/i18n/termCopy';
import type { Term } from '@/lib/routing/academicTerms';
import { useHasPlanForTerm } from './switchPlanTerm';

interface TermSwitchLabelProps {
  term: Term;
  t: Translate;
}

export function TermSwitchLabel({ term, t }: TermSwitchLabelProps) {
  return <>{termSwitchLabel(useHasPlanForTerm(term), term, t)}</>;
}
