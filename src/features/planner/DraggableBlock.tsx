// The edit mode wrapper that turns a placed meeting into a drag source. It owns the
// draggable registration and the long press feedback of ADR-0058 and hands the ref, the
// listeners, and the pressed state to the presentational EventBlock, so the block stays
// free of the drag library and preview mode can render the same EventBlock with no
// draggable at all. The id is per meeting node because a section with two meetings
// mounts two blocks, and drag ids must be unique; the shared teachTableId travels in the
// drag data so a grab on either meeting moves the section.

import { useMemo, type CSSProperties, type MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Meeting } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { EventBlock } from './EventBlock';
import type { PlacedSection } from './placedSection';
import { useTouchPress } from './useTouchPress';

interface DraggableBlockProps {
  section: PlacedSection;
  meeting: Meeting;
  style: CSSProperties;
  locale: Locale;
  t: Translate;
  pulsing?: boolean;
  dimmed?: boolean;
  conflicted?: boolean;
  examConflicted?: boolean;
  onRemove: (teachTableId: string) => void;
  removeLabel: string;
  onOpenDetail?: (anchor: HTMLElement) => void;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  fitKey?: string;
  fitPaused?: boolean;
}

export function DraggableBlock({
  section,
  meeting,
  ...rest
}: DraggableBlockProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `block-${section.teachTableId}-${String(meeting.day)}-${String(meeting.startMin)}`,
    data: { block: true, teachTableId: section.teachTableId },
  });
  const press = useTouchPress();
  // The press handlers listen on pointer events and the drag sensors on mouse down and
  // touch start, so the two sets merge without a shared key. Memoized so the block's
  // shallow prop comparison still holds between renders.
  const dragListeners = useMemo(
    () => ({ ...press.handlers, ...listeners }),
    [press.handlers, listeners],
  );
  return (
    <EventBlock
      section={section}
      meeting={meeting}
      dragRef={setNodeRef}
      dragListeners={dragListeners}
      pressed={press.pressed && !isDragging}
      {...rest}
    />
  );
}
