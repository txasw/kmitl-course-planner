// The day or week choice of the narrow timetable (ADR-0049). It shows only while the grid
// scroller is narrower than 640 px, where the day view is the default and the week renders
// in portrait. It takes the quiet segmented look, since it arranges the timetable rather
// than changing the panel, so the header mode toggle stays the one filled control. The
// choice lives in the ui store and the prefs persistence writes it, so it survives a reload.

import { useStore } from 'zustand';
import { SegmentedControl } from '@/components/SegmentedControl';
import type { Translate } from '@/lib/i18n/t';
import type { TimetableView } from '@/lib/planner/dayView';
import { uiStore } from '@/features/shell/uiStore';

interface TimetableViewToggleProps {
  t: Translate;
}

export function TimetableViewToggle({ t }: TimetableViewToggleProps) {
  const view = useStore(uiStore, (state) => state.timetableView);
  const setView = useStore(uiStore, (state) => state.setTimetableView);
  const options: readonly { value: TimetableView; label: string }[] = [
    { value: 'day', label: t('view.layoutDay') },
    { value: 'week', label: t('view.layoutWeek') },
  ];
  return (
    <SegmentedControl
      ariaLabel={t('view.layout')}
      value={view}
      options={options}
      onChange={setView}
      variant="quiet"
    />
  );
}
