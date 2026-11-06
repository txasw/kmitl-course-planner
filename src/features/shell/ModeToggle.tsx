import { useStore } from 'zustand';
import { Eye, Pencil, type LucideIcon } from 'lucide-react';
import { SegmentedControl } from '@/components/SegmentedControl';
import { uiStore, type ViewMode } from './uiStore';
import { useTranslation } from './useTranslation';

// The edit and preview mode toggle. It writes the mode to the ui store; the App
// persists it. Edit enables every mutation path; preview collapses the catalog column into
// a clean poster composition for sharing. It keeps the filled look at every width and
// narrows to a Pencil and an Eye segment below 640 px, named by their sr-only labels, so
// preview and sharing stay one tap away on a phone.
export function ModeToggle() {
  const viewMode = useStore(uiStore, (state) => state.viewMode);
  const setViewMode = useStore(uiStore, (state) => state.setViewMode);
  const { t } = useTranslation();

  const options: readonly {
    value: ViewMode;
    label: string;
    icon: LucideIcon;
  }[] = [
    { value: 'edit', label: t('mode.edit'), icon: Pencil },
    { value: 'preview', label: t('mode.preview'), icon: Eye },
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
