import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { uiStore } from '@/features/shell/uiStore';
import { DisplayOptionsPopover } from './DisplayOptionsPopover';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
  });
});

describe('DisplayOptionsPopover', () => {
  it('opens the popover and toggles an option in the store', () => {
    render(<DisplayOptionsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    const showRoom = screen.getByRole('switch', { name: 'แสดงห้อง' });
    expect(showRoom).toBeChecked();

    fireEvent.click(showRoom);
    expect(uiStore.getState().displayOptions.showRoom).toBe(false);
  });

  it('reflects the current store state on each option', () => {
    act(() => {
      uiStore.getState().setDisplayOption('fitToContent', false);
    });
    render(<DisplayOptionsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    expect(
      screen.getByRole('switch', { name: 'ย่อพอดีกับเนื้อหา' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: 'แสดงกลุ่มเรียน' }),
    ).toBeChecked();
  });
});
