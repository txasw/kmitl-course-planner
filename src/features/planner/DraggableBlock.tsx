// The edit mode wrapper that turns a placed meeting into a drag source. It owns the
// draggable registration and hands the ref and pointer listeners to the presentational
// EventBlock, so the block stays free of the drag library and preview mode can render
// the same EventBlock with no draggable at all. The id is per meeting node because a
// section with two meetings mounts two blocks, and drag ids must be unique; the shared
// teachTableId travels in the drag data so a grab on either meeting moves the section.

import type { CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { EventBlock } from './EventBlock';
import type { PlacedSection } from './placedSection';

interface DraggableBlockProps {
  section: PlacedSection;
  meeting: Meeting;
  style: CSSProperties;
  locale: Locale;
  t: Translate;
  pulsing?: boolean;
  dimmed?: boolean;
  conflicted?: boolean;
  onRemove: () => void;
  removeLabel: string;
  onOpenDetail?: (anchor: HTMLElement) => void;
}

export function DraggableBlock({
  section,
  meeting,
  ...rest
}: DraggableBlockProps) {
  const { setNodeRef, listeners } = useDraggable({
    id: `block-${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`,
    data: { block: true, teachTableId: section.teachTableId },
  });
  return (
    <EventBlock
      section={section}
      meeting={meeting}
      dragRef={setNodeRef}
      dragListeners={listeners}
      {...rest}
    />
  );
}
