// A short guard on the results after a user search. The form folds at the press and
// the results rise under the pointer, so the second click of a double click, a touch
// ghost click, or a pointer down that would start a drag could land on a card or an
// add button the student never aimed at. For half a second the results ignore pointer
// input; wheel scrolling still reaches the scroller and the keyboard is untouched.
// The guard alone subscribes to the submit time, and the results arrive as children
// whose elements keep their identity, so lifting the guard never re-renders them. The
// data attribute lets an end to end drag wait for the guard before it presses.

import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { searchStore } from '@/features/search/searchStore';

/** The Windows default double click time, which also covers touch ghost clicks. */
export const INPUT_GUARD_MS = 500;

export function InputGuard({ children }: { children: ReactNode }) {
  const lastSubmitAt = useStore(searchStore, (state) => state.lastSubmitAt);
  // A submit made before this mount, such as one before the overlay reopened, is
  // already lifted, so only a submit seen while mounted guards the results.
  const [liftedFor, setLiftedFor] = useState(lastSubmitAt);

  useEffect(() => {
    if (lastSubmitAt === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setLiftedFor(lastSubmitAt);
    }, INPUT_GUARD_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [lastSubmitAt]);

  const guarded = lastSubmitAt !== null && liftedFor !== lastSubmitAt;
  return (
    <div
      data-input-guard={guarded ? 'on' : 'off'}
      className={`flex flex-1 flex-col ${guarded ? 'pointer-events-none' : ''}`}
    >
      {children}
    </div>
  );
}
