// Holds a timed notice while the pointer rests on it or focus is within it, per WCAG
// timing (SC 2.2.1), so a control does not leave under the pointer or the keyboard. The
// caller spreads the handlers on the notice's outer element; the capture phase focus
// and blur handlers cover the controls inside it. The hold is keyed by the notice
// identity, so a hold never outlives its notice: a new key starts released even when
// the pointer still rests where the previous notice was.

import { useMemo, useState } from 'react';

type HoldKey = string | number;

export interface HoldHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocusCapture: () => void;
  onBlurCapture: () => void;
}

interface HoverFocusHold {
  held: boolean;
  handlers: HoldHandlers;
}

export function useHoverFocusHold(key: HoldKey | null): HoverFocusHold {
  const [heldKey, setHeldKey] = useState<HoldKey | null>(null);
  const handlers = useMemo<HoldHandlers>(() => {
    const hold = () => {
      setHeldKey(key);
    };
    const release = () => {
      setHeldKey(null);
    };
    return {
      onMouseEnter: hold,
      onMouseLeave: release,
      onFocusCapture: hold,
      onBlurCapture: release,
    };
  }, [key]);
  return { held: key !== null && heldKey === key, handlers };
}
