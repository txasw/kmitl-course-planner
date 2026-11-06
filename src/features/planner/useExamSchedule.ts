// The active plan's exam schedule, rebuilt only when the plan entries change. The summary
// view renders it, and the summary tab and nav item read its clash flag for their danger
// dot, so every surface marks the same clash the schedule lists.

import { useMemo } from 'react';
import { useStore } from 'zustand';
import {
  buildExamSchedule,
  type ExamSchedule,
} from '@/lib/planner/examSchedule';
import { planStore } from '@/features/plans/planStore';

export function useExamSchedule(): ExamSchedule {
  const entries = useStore(planStore, (state) => state.entries);
  return useMemo(() => buildExamSchedule(entries), [entries]);
}
