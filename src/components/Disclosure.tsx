// A collapsed section behind a quiet text toggle, the system chevron disclosure the
// catalog groups and the tick list use, in place of a native details element whose
// browser marker sits outside the icon set. The toggle is a button that states
// aria-expanded and names the panel it controls while that panel is shown; the chevron
// points right while collapsed and down while expanded, and under reduced motion it
// turns without the transition. The panel starts collapsed and holds its own state, so
// a parent that remounts it, such as a carousel slide ranked again, starts it collapsed.

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';

interface DisclosureProps {
  /** The toggle text, already localized. */
  label: string;
  children: ReactNode;
}

export function Disclosure({ label, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col text-xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen(!open);
        }}
        className={`flex w-fit max-w-full items-center gap-1 rounded-kcp px-1 text-left text-ink-soft hover:text-ink ${TARGET_HEIGHT} ${FOCUS_RING}`}
      >
        <ChevronDown
          size={14}
          aria-hidden
          className={`shrink-0 transition-transform duration-fast motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
        />
        <span className="min-w-0">{label}</span>
      </button>
      {open ? (
        <div id={panelId} className="px-1">
          {children}
        </div>
      ) : null}
    </div>
  );
}
