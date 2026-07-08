import { useStore } from 'zustand';
import { SegmentedControl } from '@/components/SegmentedControl';
import { uiStore, type ViewMode } from './uiStore';
import { useTranslation } from './useTranslation';

// The edit and preview mode toggle. It writes the mode to the ui store; the App
// persists it. Edit enables every mutation path; preview collapses the rails into
// a clean poster composition for sharing.
export function ModeToggle() {
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const setViewMode = useStore(uiStore, (state) => state.setViewMode);
  const { t } = useTranslation();

  const options: readonly { value: ViewMode; label: string }[] = [
    { value: 'edit', label: t('mode.edit') },
    { value: 'preview', label: t('mode.preview') },
  ];

  return (
    <SegmentedControl
      ariaLabel={t('mode.select')}
      value={viewMode}
      options={options}
      onChange={setViewMode}
    />
  );
}
