// A single course drag candidate footprint on the grid. A valid candidate is a drop
// target styled as a success slot labeled with its section code; a blocked one is a
// hatched danger slot that takes no drop, including full and closed sections so the
// picture stays complete. The raised candidate, the one the pointer is over, lifts
// above the others with a ring so a crowded cell stays legible.

import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Candidate } from '@/lib/planner/courseCandidates';

interface CandidateSlotProps {
  id: string;
  candidate: Candidate;
  style: CSSProperties;
  raised: boolean;
}

export function CandidateSlot({
  id,
  candidate,
  style,
  raised,
}: CandidateSlotProps) {
  const { setNodeRef } = useDroppable({
    id,
    disabled: !candidate.valid,
    data: { section: candidate.section },
  });
  return (
    <div
      ref={setNodeRef}
      data-candidate={candidate.valid ? 'valid' : 'blocked'}
      className={`pointer-events-none m-px overflow-hidden rounded-kcp border px-1 py-0.5 text-[10px] font-semibold leading-tight ${
        candidate.valid
          ? 'border-success bg-success-soft text-success'
          : 'kcp-hatch border-danger bg-danger-soft text-danger'
      } ${raised ? 'z-30 opacity-100 shadow-kcp ring-2 ring-primary' : 'z-10 opacity-90'}`}
      style={style}
    >
      {candidate.section.section}
    </div>
  );
}
