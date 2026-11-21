// The chevron of the system disclosure, shared by the Disclosure toggle, the catalog
// group headings, the suggestion tick list groups, and the unchanged group of the updates
// dialog, so every disclosure turns the same way: right while collapsed, down while
// expanded, and without the transition under reduced motion.

import { ChevronDown } from 'lucide-react';

export function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size={14}
      aria-hidden
      className={`shrink-0 transition-transform duration-fast motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
    />
  );
}
