import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  within,
} from '@testing-library/react';
import { installViewport } from '../../../tests/support/viewport';
import { DEFAULT_DISPLAY_OPTIONS } from '@/lib/planner/displayOptions';
import { PanelPortalContext } from '@/features/shell/PanelPortalContext';
import { uiStore } from '@/features/shell/uiStore';
import { DisplayOptionsPopover } from './DisplayOptionsPopover';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
    uiStore.getState().setLanguage('th');
  });
});

describe('DisplayOptionsPopover', () => {
  // The popover is the form from 640 px up; the sheet below has its own suite.
  beforeEach(() => {
    installViewport(1366);
  });

  it('opens an anchored popover, not a dialog', () => {
    render(<DisplayOptionsPopover />);
    const trigger = screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' });
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('switch', { name: 'แสดงห้อง' }),
    ).toBeInTheDocument();
  });

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

describe('DisplayOptionsPopover below 640 px', () => {
  beforeEach(() => {
    installViewport(390);
  });

  function renderInPanel() {
    render(
      <PanelPortalContext.Provider value={document.body}>
        <DisplayOptionsPopover />
      </PanelPortalContext.Provider>,
    );
  }

  it('opens the options as a modal bottom sheet that keeps the switches live', () => {
    renderInPanel();
    const trigger = screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(trigger);
    const sheet = screen.getByRole('dialog', { name: 'ตัวเลือกการแสดงผล' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('heading', { name: 'ตัวเลือกการแสดงผล' }),
    ).toHaveFocus();

    // A press inside the sheet toggles the option and leaves the sheet open.
    const showRoom = within(sheet).getByRole('switch', { name: 'แสดงห้อง' });
    fireEvent.pointerDown(showRoom);
    fireEvent.mouseDown(showRoom);
    fireEvent.click(showRoom);
    expect(uiStore.getState().displayOptions.showRoom).toBe(false);
    expect(
      screen.getByRole('dialog', { name: 'ตัวเลือกการแสดงผล' }),
    ).toBeInTheDocument();
  });

  it('closes from its close button and returns focus to the trigger', () => {
    renderInPanel();
    const trigger = screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape without the press reaching the overlay', () => {
    renderInPanel();
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    const outer = vi.fn();
    document.body.addEventListener('keydown', outer);
    fireEvent.keyDown(screen.getByRole('switch', { name: 'แสดงห้อง' }), {
      key: 'Escape',
    });
    document.body.removeEventListener('keydown', outer);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outer).not.toHaveBeenCalled();
  });
});
