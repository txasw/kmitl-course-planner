import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import { CATALOG_TOGGLE_ID } from '@/features/shell/catalogVisibility';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { makeSection } from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { confirmAdd } from './addToPlan';

const t = createTranslator('th');
const section = makeSection({ subjectId: '90592033', section: '901' });

afterEach(() => {
  vi.unstubAllGlobals();
  toastStore.getState().dismiss();
  uiStore.getState().setSheetOpen(false);
  document.body.replaceChildren();
});

describe('confirmAdd', () => {
  it.each([390, 768])(
    'raises a toast with a timetable action over the open sheet at %i px',
    (width) => {
      installViewport(width);
      uiStore.getState().setSheetOpen(true);
      confirmAdd(section, t);
      const { toast } = toastStore.getState();
      expect(toast?.kind).toBe('success');
      expect(toast?.message).toBe('เพิ่ม 90592033 กลุ่มเรียน 901 แล้ว');
      expect(toast?.action?.label).toBe('ดูตาราง');
    },
  );

  it('raises no toast while the sheet is closed', () => {
    installViewport(768);
    confirmAdd(section, t);
    expect(toastStore.getState().toast).toBeNull();
  });

  it('raises no toast where the column docks beside the grid', () => {
    installViewport(1280);
    uiStore.getState().setSheetOpen(true);
    confirmAdd(section, t);
    expect(toastStore.getState().toast).toBeNull();
  });

  it('closes the sheet and focuses the catalog toggle from the action', () => {
    installViewport(768);
    uiStore.getState().setSheetOpen(true);
    confirmAdd(section, t);
    const control = document.createElement('button');
    const toggle = document.createElement('button');
    toggle.id = CATALOG_TOGGLE_ID;
    document.body.append(control, toggle);
    toastStore.getState().toast?.action?.run(control);
    expect(uiStore.getState().sheetOpen).toBe(false);
    expect(document.activeElement).toBe(toggle);
  });
});
