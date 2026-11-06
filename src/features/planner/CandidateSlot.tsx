// A single course drag or block move candidate footprint on the grid. A valid candidate
// is a drop target styled as a success slot with a solid border and a label: the section
// code for an add, or the move it performs for a block move, so a move reads apart from
// an add (ADR-0059). A blocked one is a hatched danger slot labelled with its code that
// takes no drop, including full and closed sections so the picture stays complete. The
// raised candidate, the one the pointer is over, lifts above the others with a ring so a
// crowded cell stays legible.

import type { CSSProperties } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Candidate } from '@/lib/planner/courseCandidates';

interface CandidateSlotProps {
  id: string;
  candidate: Candidate;
  style: CSSProperties;
  raised: boolean;
  /** The visible label, resolved by the layer for the gesture that painted the slot. */
  label: string;
}

export function CandidateSlot({
  id,
  candidate,
  style,
  raised,
  label,
}: CandidateSlotProps) {
  const { setNodeRef } = useDroppable({
    id,
    // A time or duplicate blocked candidate stays droppable so hovering it can raise
    // its blockers as swap targets and a drop on it can reject with the reason; only a
    // seat blocked candidate, which no swap can help, is inert.
    disabled: !candidate.valid && candidate.conflicts.length === 0,
    data: {
      role: 'candidate',
      section: candidate.section,
      valid: candidate.valid,
    },
  });
  return (
    <div
      ref={setNodeRef}
      data-candidate={candidate.valid ? 'valid' : 'blocked'}
      className={`pointer-events-none m-px overflow-hidden rounded-kcp border px-1 py-0.5 text-[10px] font-semibold leading-tight break-words ${
        candidate.valid
          ? 'border-success bg-success-soft text-success'
          : 'kcp-hatch border-danger bg-danger-soft text-danger'
      } ${raised ? 'z-grid-active opacity-100 shadow-kcp ring-2 ring-primary' : 'z-grid opacity-90'}`}
      style={style}
    >
      {label}
    </div>
  );
}
