// A collapsed section behind a quiet text toggle, in place of a native details element
// whose browser marker sits outside the icon set. The toggle is a button that states
// aria-expanded and names the panel it controls while that panel is shown, and carries
// the shared DisclosureChevron the catalog group and tick list headings carry too, so
// every disclosure turns alike. The panel starts collapsed and holds its own state, so
// a parent that remounts it, such as a carousel slide ranked again, starts it collapsed.

import { useId, useState, type ReactNode } from 'react';
import { DisclosureChevron } from './DisclosureChevron';
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
        <DisclosureChevron open={open} />
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
