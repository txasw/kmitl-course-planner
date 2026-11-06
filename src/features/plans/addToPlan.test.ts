import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import { dragStore } from '@/features/planner/dragStore';
import { CATALOG_TOGGLE_ID } from '@/features/shell/catalogVisibility';
import { navItemId } from '@/features/shell/mobilePane';
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
  dragStore.getState().clearAnnouncement();
  uiStore.getState().setSheetOpen(false);
  uiStore.setState({ mobilePane: null, planView: 'timetable' });
  document.body.replaceChildren();
});

describe('confirmAdd', () => {
  it('raises a toast with a timetable action over the open sheet', () => {
    installViewport(768);
    uiStore.getState().setSheetOpen(true);
    confirmAdd(section, t);
    const { toast } = toastStore.getState();
    expect(toast?.kind).toBe('success');
    expect(toast?.message).toBe('เพิ่ม 90592033 กลุ่มเรียน 901 แล้ว');
    expect(toast?.action?.label).toBe('ดูตาราง');
  });

  it('raises the toast below 640 px while the catalog pane is shown', () => {
    installViewport(390);
    uiStore.getState().setMobilePane('catalog');
    confirmAdd(section, t);
    expect(toastStore.getState().toast?.action?.label).toBe('ดูตาราง');
    expect(dragStore.getState().announcement).toBeNull();
  });

  it('announces through the strip below 640 px while the plan pane is shown', () => {
    installViewport(390);
    uiStore.getState().setMobilePane('plan');
    // A sheet left open on a wider window covers nothing on the phone layout.
    uiStore.getState().setSheetOpen(true);
    confirmAdd(section, t);
    expect(toastStore.getState().toast).toBeNull();
    expect(dragStore.getState().announcement).toBe('เพิ่มลงตารางแล้ว 90592033');
  });

  it('shows the timetable pane and focuses its nav item from the action below 640 px', () => {
    installViewport(390);
    uiStore.getState().setMobilePane('catalog');
    uiStore.getState().setPlanView('selected');
    confirmAdd(section, t);
    const control = document.createElement('button');
    const item = document.createElement('button');
    item.id = navItemId('timetable');
    document.body.append(control, item);
    toastStore.getState().toast?.action?.run(control);
    expect(uiStore.getState().mobilePane).toBe('plan');
    expect(uiStore.getState().planView).toBe('timetable');
    expect(document.activeElement).toBe(item);
  });

  it('leaves the strip silent while the toast speaks', () => {
    installViewport(768);
    uiStore.getState().setSheetOpen(true);
    confirmAdd(section, t);
    expect(dragStore.getState().announcement).toBeNull();
  });

  it('announces through the strip while the sheet is closed', () => {
    installViewport(768);
    confirmAdd(section, t);
    expect(toastStore.getState().toast).toBeNull();
    expect(dragStore.getState().announcement).toBe('เพิ่มลงตารางแล้ว 90592033');
  });

  it('announces through the strip where the column docks beside the grid', () => {
    installViewport(1280);
    uiStore.getState().setSheetOpen(true);
    confirmAdd(section, t);
    expect(toastStore.getState().toast).toBeNull();
    expect(dragStore.getState().announcement).toBe('เพิ่มลงตารางแล้ว 90592033');
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
