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
    uiStore.getState().setLanguage('th');
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
      uiStore.getState().setDisplayOption('showRoom', false);
    });
    render(<DisplayOptionsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    expect(screen.getByRole('switch', { name: 'แสดงห้อง' })).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: 'แสดงกลุ่มเรียน' }),
    ).toBeChecked();
  });

  it('disables the show English names option in English', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<DisplayOptionsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    const option = screen.getByRole('switch', { name: 'Show English names' });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(option);
    // A disabled switch does not change the stored value.
    expect(uiStore.getState().displayOptions.showEnglishNames).toBe(true);
  });

  it('leaves the show English names option enabled in Thai', () => {
    render(<DisplayOptionsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    expect(
      screen.getByRole('switch', { name: 'แสดงชื่อภาษาอังกฤษ' }),
    ).not.toHaveAttribute('aria-disabled');
  });

  it('no longer surfaces the retired fit to content option', () => {
    render(<DisplayOptionsPopover />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    expect(
      screen.queryByRole('switch', { name: 'ย่อพอดีกับเนื้อหา' }),
    ).not.toBeInTheDocument();
  });
});
