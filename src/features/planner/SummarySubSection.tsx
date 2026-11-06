// A titled part of a summary view section, such as the midterm list of the exam schedule
// or the free weekdays of the workload. Each is a region named by its own heading, so a
// screen reader can move between the parts the way a sighted reader scans the titles.

import { useId, type ReactNode } from 'react';

interface SummarySubSectionProps {
  title: string;
  children: ReactNode;
}

export function SummarySubSection({ title, children }: SummarySubSectionProps) {
  const headingId = `${useId()}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="text-xs font-semibold text-ink-soft">
        {title}
      </h4>
      {children}
    </section>
  );
}
