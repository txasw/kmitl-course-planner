// The remove control on an added course. It reads as a pull back: a compact, quiet
// undo-arrow icon rather than a bordered text button, because the ten second undo
// makes a remove reversible, so the metaphor is truthful. The aria-label and the
// tooltip still state the plain action. onPointerDown stops propagation so a grab on
// the control does not arm a surrounding drag.

import { Undo2 } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { FOCUS_RING } from '@/lib/ui/focus';

interface RemoveButtonProps {
  label: string;
  onRemove: () => void;
}

export function RemoveButton({ label, onRemove }: RemoveButtonProps) {
  return (
    <Tooltip label={label}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-label={label}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={onRemove}
          className={`shrink-0 rounded-kcp p-1 text-ink-soft hover:bg-surface hover:text-ink ${FOCUS_RING}`}
        >
          <Undo2 size={14} aria-hidden />
        </button>
      )}
    </Tooltip>
  );
}
