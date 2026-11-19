// One outcome on screen at a time. The feedback strip and the toast each report what the
// last action did, and on the phone and in the sheet they float at the same foot, so a
// blocked add shown over the toast of the add before it stacked a danger notice on a
// success line and read as two answers to one press. The newer outcome replaces the
// older: a strip notice that arrives dismisses the toast on screen, and a toast that
// arrives dismisses the strip notice. The stores are linked by subscription rather than
// in render, so whichever write lands last wins even inside one handler. The undo toast
// is left alone, because it holds the only way back from a removal for its window, and
// the screen reader only add line is not a visible notice.

import { useEffect } from 'react';
import { toastStore } from '@/features/shell/toastStore';
import { dragStore, type DragStore } from './dragStore';

function visibleNotice(state: DragStore): unknown {
  return state.crossTerm ?? state.blocked ?? state.hint;
}

export function useOneOutcomeSurface(): void {
  useEffect(() => {
    const stopToast = toastStore.subscribe((state, previous) => {
      if (state.toast !== null && state.toast.id !== previous.toast?.id) {
        dragStore.getState().dismissNotice();
      }
    });
    const stopStrip = dragStore.subscribe((state, previous) => {
      const notice = visibleNotice(state);
      if (notice !== null && notice !== visibleNotice(previous)) {
        toastStore.getState().dismiss();
      }
    });
    return () => {
      stopToast();
      stopStrip();
    };
  }, []);
}
