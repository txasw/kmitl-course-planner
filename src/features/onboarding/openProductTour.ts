// The one way the student reopens the product tour (ADR-0074), from the overflow menu or
// from the replay action on the toast a finished tour leaves. The tour points at the edit
// workspace, so from the export page it returns to editing first. Both writes land in one
// render; the tour reads which steps the panel offers only after that render commits.

import { backToEditing } from '@/features/shell/ExportEntry';
import { uiStore } from '@/features/shell/uiStore';
import { onboardingStore } from './onboardingStore';

/** Opens the product tour from its first step, on the edit workspace. */
export function openProductTour(): void {
  if (uiStore.getState().viewMode === 'preview') backToEditing();
  onboardingStore.getState().startTour();
}
