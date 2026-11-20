import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { Overlay } from '@/features/shell/Overlay';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { TOUR_VERSION } from '@/lib/onboarding/tour';
import type { OnboardingPatch } from '@/lib/storage/onboarding';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import { installViewport } from '../../../tests/support/viewport';
import { initialOnboardingData, onboardingStore } from './onboardingStore';
import { ProductTour } from './ProductTour';

// The panel opens on the catalog with no search yet, so the search step points at the
// search tabs, the add step at the search button, the timetable step at the timetable
// tab or the bottom nav item, and the export step at the header button. No curriculum
// search ran, so there is no suggest step and the count says four.

function fakeRecord() {
  return {
    patch: vi.fn((fields: OnboardingPatch) =>
      Promise.resolve({ schemaVersion: 1 as const, ...fields }),
    ),
  };
}

function renderTour(width: number) {
  installViewport(width, { reducedMotion: true });
  const record = fakeRecord();
  render(
    <SearchDepsProvider value={fakeSearchDeps()}>
      <Overlay>
        <ProductTour record={record} />
      </Overlay>
    </SearchDepsProvider>,
  );
  act(() => {
    uiStore.getState().open();
    onboardingStore.getState().startTour();
  });
  return record;
}

// The card is found by its data attribute, since on the medium tier the open catalog
// sheet is a dialog whose name the search step's title shares.
function card(): HTMLElement {
  const node = document.querySelector('[data-tour-card]');
  if (!(node instanceof HTMLElement)) throw new Error('no tour card');
  return node;
}

async function stepTitled(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const node = card();
    expect(node).toHaveAttribute('role', 'dialog');
    expect(node).toHaveAccessibleName(title);
    return node;
  });
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
    uiStore.getState().setViewMode('edit');
  });
  onboardingStore.setState(initialOnboardingData());
  toastStore.getState().dismiss();
});

describe('ProductTour', () => {
  it('opens on the search step with focus on Next and the count', async () => {
    renderTour(1366);
    const dialog = await stepTitled('ค้นหารายวิชา');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      'ค้นหาตามหลักสูตรและชั้นปี รหัสวิชา หรือหมวดวิชา เลือกวิธีค้นหาจากแถบนี้',
    );
    expect(dialog).toHaveTextContent('1 จาก 4');
    expect(button('ถัดไป')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'ย้อนกลับ' })).toBeNull();
  });

  it('walks forward and back, and speaks each step after the first', async () => {
    renderTour(1366);
    await stepTitled('ค้นหารายวิชา');
    fireEvent.click(button('ถัดไป'));
    const add = await stepTitled('เพิ่มกลุ่มเรียนลงตาราง');
    expect(add).toHaveTextContent('2 จาก 4');
    expect(add.querySelector('[aria-live="polite"]')).toHaveTextContent(
      '2 จาก 4 เพิ่มกลุ่มเรียนลงตาราง',
    );
    fireEvent.click(button('ย้อนกลับ'));
    await stepTitled('ค้นหารายวิชา');
    // Back leaves the card on the first step, so focus moves to Next.
    await waitFor(() => {
      expect(button('ถัดไป')).toHaveFocus();
    });
  });

  it('keeps Tab inside the card', async () => {
    renderTour(1366);
    await stepTitled('ค้นหารายวิชา');
    fireEvent.click(button('ถัดไป'));
    await stepTitled('เพิ่มกลุ่มเรียนลงตาราง');
    button('ถัดไป').focus();
    fireEvent.keyDown(button('ถัดไป'), { key: 'Tab' });
    expect(button('ย้อนกลับ')).toHaveFocus();
    fireEvent.keyDown(button('ย้อนกลับ'), { key: 'Tab', shiftKey: true });
    expect(button('ถัดไป')).toHaveFocus();
  });

  it('skips on Escape, records it, and returns focus to the search tabs', async () => {
    const record = renderTour(1366);
    await stepTitled('ค้นหารายวิชา');
    fireEvent.keyDown(button('ถัดไป'), { key: 'Escape' });
    expect(document.querySelector('[data-tour-card]')).toBeNull();
    expect(uiStore.getState().isOpen).toBe(true);
    const mark = record.patch.mock.calls[0]?.[0].tourSeen;
    expect(mark?.version).toBe(TOUR_VERSION);
    expect(mark?.outcome).toBe('skipped');
    expect(screen.getAllByRole('tab')[0]).toHaveFocus();
    expect(toastStore.getState().toast?.message).toBe(
      'เปิดดูการแนะนำการใช้งานอีกครั้งได้จากเมนูตัวเลือกเพิ่มเติม',
    );
  });

  it('returns focus to the selected search tab, not the first', async () => {
    installViewport(1366, { reducedMotion: true });
    render(
      <SearchDepsProvider value={fakeSearchDeps()}>
        <Overlay>
          <ProductTour record={fakeRecord()} />
        </Overlay>
      </SearchDepsProvider>,
    );
    act(() => {
      uiStore.getState().open();
    });
    const second = screen.getAllByRole('tab')[1];
    if (second === undefined) throw new Error('no second tab');
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-selected', 'true');
    act(() => {
      onboardingStore.getState().startTour();
    });
    await stepTitled('ค้นหารายวิชา');
    fireEvent.click(button('ข้าม'));
    expect(screen.getAllByRole('tab')[1]).toHaveFocus();
  });

  it('finishes on the export step and hands focus to the export button', async () => {
    const record = renderTour(1366);
    await stepTitled('ค้นหารายวิชา');
    for (const title of ['เพิ่มกลุ่มเรียนลงตาราง', 'ดูตารางเรียน']) {
      fireEvent.click(button('ถัดไป'));
      await stepTitled(title);
    }
    fireEvent.click(button('ถัดไป'));
    const last = await stepTitled('ส่งออกตาราง');
    expect(last).toHaveTextContent('4 จาก 4');
    fireEvent.click(button('เสร็จสิ้น'));
    expect(onboardingStore.getState().tourOpen).toBe(false);
    expect(record.patch.mock.calls[0]?.[0].tourSeen?.outcome).toBe('completed');
    expect(button('ส่งออก')).toHaveFocus();
  });

  it('replays from the toast action', async () => {
    renderTour(1366);
    await stepTitled('ค้นหารายวิชา');
    fireEvent.click(button('ข้าม'));
    const action = toastStore.getState().toast?.action;
    expect(action?.label).toBe('ดูอีกครั้ง');
    act(() => {
      action?.run(document.body);
    });
    await stepTitled('ค้นหารายวิชา');
  });

  it('switches the phone pane to the timetable for the timetable step', async () => {
    renderTour(390);
    await stepTitled('ค้นหารายวิชา');
    expect(uiStore.getState().mobilePane).toBe('catalog');
    fireEvent.click(button('ถัดไป'));
    await stepTitled('เพิ่มกลุ่มเรียนลงตาราง');
    fireEvent.click(button('ถัดไป'));
    await stepTitled('ดูตารางเรียน');
    expect(uiStore.getState().mobilePane).toBe('plan');
    expect(uiStore.getState().planView).toBe('timetable');
    fireEvent.click(button('ย้อนกลับ'));
    await stepTitled('เพิ่มกลุ่มเรียนลงตาราง');
    expect(uiStore.getState().mobilePane).toBe('catalog');
  });

  it('opens the catalog sheet for the catalog steps on the medium tier', async () => {
    renderTour(768);
    await stepTitled('ค้นหารายวิชา');
    expect(uiStore.getState().sheetOpen).toBe(true);
    fireEvent.click(button('ถัดไป'));
    await stepTitled('เพิ่มกลุ่มเรียนลงตาราง');
    fireEvent.click(button('ถัดไป'));
    await stepTitled('ดูตารางเรียน');
    expect(uiStore.getState().sheetOpen).toBe(false);
    // The sheet that opened took focus into itself; the card takes it back.
    await waitFor(() => {
      expect(card()).toContainElement(
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      );
    });
  });

  it('opens from the menu on the export page on the search step and records nothing', async () => {
    installViewport(1366, { reducedMotion: true });
    const record = fakeRecord();
    render(
      <SearchDepsProvider value={fakeSearchDeps()}>
        <Overlay>
          <ProductTour record={record} />
        </Overlay>
      </SearchDepsProvider>,
    );
    act(() => {
      uiStore.getState().open();
      uiStore.getState().setViewMode('preview');
    });
    fireEvent.click(button('ตัวเลือกเพิ่มเติม'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'แนะนำการใช้งาน' }));
    const dialog = await stepTitled('ค้นหารายวิชา');
    expect(dialog).toHaveTextContent('1 จาก 4');
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(record.patch).not.toHaveBeenCalled();
    expect(toastStore.getState().toast).toBeNull();
  });

  it('replays from the toast action after the student moved to the export page', async () => {
    const record = renderTour(1366);
    await stepTitled('ค้นหารายวิชา');
    fireEvent.click(button('ข้าม'));
    const action = toastStore.getState().toast?.action;
    act(() => {
      uiStore.getState().setViewMode('preview');
    });
    act(() => {
      action?.run(document.body);
    });
    await stepTitled('ค้นหารายวิชา');
    expect(uiStore.getState().viewMode).toBe('edit');
    expect(record.patch).toHaveBeenCalledTimes(1);
  });

  it('reads in English', async () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    renderTour(1366);
    const dialog = await stepTitled('Search for courses');
    expect(dialog).toHaveTextContent('1 of 4');
    expect(button('Next')).toHaveFocus();
    expect(button('Skip')).toBeInTheDocument();
  });
});
