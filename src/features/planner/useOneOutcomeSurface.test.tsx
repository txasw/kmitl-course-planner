import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toastStore } from '@/features/shell/toastStore';
import { dragStore } from './dragStore';
import { useOneOutcomeSurface } from './useOneOutcomeSurface';

const course = makeCourse({ subjectId: '90000002' });
const section = makeSection({ subjectId: '90000002', teachTableId: 'b1' });

function showBlocked(): void {
  dragStore.getState().showBlocked({
    course,
    section,
    conflicts: [
      {
        kind: 'time',
        blocking: { teachTableId: 'p', subjectId: '90000001', section: '901' },
        day: 1,
        startMin: 540,
        endMin: 600,
      },
    ],
  });
}

afterEach(() => {
  cleanup();
  act(() => {
    dragStore.getState().dismissNotice();
    dragStore.getState().clearAnnouncement();
    toastStore.getState().dismiss();
  });
});

describe('useOneOutcomeSurface', () => {
  it('dismisses the add toast when a blocked notice follows it', () => {
    renderHook(() => {
      useOneOutcomeSurface();
    });
    act(() => {
      toastStore.getState().show('success', 'เพิ่ม 90000001 กลุ่มเรียน 901 แล้ว');
    });
    act(() => {
      showBlocked();
    });
    expect(dragStore.getState().blocked).not.toBeNull();
    expect(toastStore.getState().toast).toBeNull();
  });

  it('clears the strip notice when a newer toast arrives', () => {
    renderHook(() => {
      useOneOutcomeSurface();
    });
    act(() => {
      showBlocked();
    });
    act(() => {
      toastStore.getState().show('success', 'คัดลอกแล้ว');
    });
    expect(toastStore.getState().toast?.message).toBe('คัดลอกแล้ว');
    expect(dragStore.getState().blocked).toBeNull();
  });

  it('dismisses the toast for a cross term notice and a hint', () => {
    renderHook(() => {
      useOneOutcomeSurface();
    });
    act(() => {
      toastStore.getState().show('success', 'one');
      dragStore.getState().setHint('วางบนช่องที่ไฮไลต์');
    });
    expect(toastStore.getState().toast).toBeNull();
    act(() => {
      toastStore.getState().show('success', 'two');
    });
    expect(dragStore.getState().hint).toBeNull();
    act(() => {
      dragStore.getState().showCrossTerm({
        planTerm: { year: '2569', semester: '1' },
        incomingTerm: { year: '2569', semester: '2' },
      });
    });
    expect(toastStore.getState().toast).toBeNull();
  });

  it('leaves the toast alone for the screen reader only add line', () => {
    renderHook(() => {
      useOneOutcomeSurface();
    });
    act(() => {
      toastStore.getState().show('success', 'คัดลอกแล้ว');
      dragStore.getState().announce('เพิ่มแล้ว 90000001');
    });
    expect(toastStore.getState().toast?.message).toBe('คัดลอกแล้ว');
  });

  it('stops linking the stores once unmounted', () => {
    const { unmount } = renderHook(() => {
      useOneOutcomeSurface();
    });
    unmount();
    act(() => {
      toastStore.getState().show('success', 'one');
      showBlocked();
    });
    expect(toastStore.getState().toast?.message).toBe('one');
  });
});
