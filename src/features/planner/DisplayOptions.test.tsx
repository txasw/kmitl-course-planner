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
import {
  DisplayOptionsPanel,
  DisplayOptionsSheet,
  DisplayOptionsToggle,
  useDisplayOptionsDisclosure,
} from './DisplayOptions';

// The wide form as the toolbar renders it: the toggle in a row and the panel after it.
function InlineOptions() {
  const { open, panelId, triggerRef, panelRef, toggle } =
    useDisplayOptionsDisclosure();
  return (
    <>
      <DisplayOptionsToggle
        open={open}
        controls={panelId}
        buttonRef={triggerRef}
        onToggle={toggle}
      />
      <button type="button">ดาวน์โหลด PNG</button>
      <DisplayOptionsPanel id={panelId} open={open} panelRef={panelRef} />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    uiStore.getState().setDisplayOptions(DEFAULT_DISPLAY_OPTIONS);
    uiStore.getState().setLanguage('th');
  });
});

describe('DisplayOptions from 640 px up', () => {
  // The inline panel is the form from 640 px up; the sheet below has its own suite.
  beforeEach(() => {
    installViewport(1366);
  });

  it('discloses an inline region the button controls, not a dialog', () => {
    render(<InlineOptions />);
    const trigger = screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' });
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const panelId = trigger.getAttribute('aria-controls') ?? '';
    // The panel stays in the DOM while hidden, so the reference always resolves.
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();
    expect(screen.queryByRole('switch')).toBeNull();

    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('dialog')).toBeNull();
    const region = screen.getByRole('region', { name: 'ตัวเลือกการแสดงผล' });
    expect(region).toBe(panel);
    expect(region).toBeVisible();
    expect(
      within(region).getByRole('switch', { name: 'แสดงห้อง' }),
    ).toBeInTheDocument();
    // Opening moves no focus off the button, as a disclosure does.
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('stays open on a press elsewhere on the page', () => {
    render(<InlineOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    const elsewhere = screen.getByRole('button', { name: 'ดาวน์โหลด PNG' });
    fireEvent.pointerDown(elsewhere);
    fireEvent.mouseDown(elsewhere);
    fireEvent.click(elsewhere);
    expect(screen.getByRole('switch', { name: 'แสดงห้อง' })).toBeInTheDocument();
  });

  it.each(['panel', 'button'] as const)(
    'closes on Escape from the %s, returns focus, and keeps the overlay open',
    (from) => {
      render(<InlineOptions />);
      const trigger = screen.getByRole('button', {
        name: 'ตัวเลือกการแสดงผล',
      });
      fireEvent.click(trigger);
      const outer = vi.fn();
      document.body.addEventListener('keydown', outer);
      const target =
        from === 'panel'
          ? screen.getByRole('switch', { name: 'แสดงห้อง' })
          : trigger;
      target.focus();
      fireEvent.keyDown(target, { key: 'Escape' });
      document.body.removeEventListener('keydown', outer);
      expect(screen.queryByRole('switch')).toBeNull();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
      expect(outer).not.toHaveBeenCalled();
    },
  );

  it('opens the panel and toggles an option in the store', () => {
    render(<InlineOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    const showRoom = screen.getByRole('switch', { name: 'แสดงห้อง' });
    expect(showRoom).toBeChecked();

    fireEvent.click(showRoom);
    expect(uiStore.getState().displayOptions.showRoom).toBe(false);
  });

  it('offers the exam schedule option off by default and stores it when turned on', () => {
    render(<InlineOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    const showExams = screen.getByRole('switch', { name: 'แสดงตารางสอบ' });
    expect(showExams).not.toBeChecked();

    fireEvent.click(showExams);
    expect(uiStore.getState().displayOptions.showExams).toBe(true);
  });

  it('reflects the current store state on each option', () => {
    act(() => {
      uiStore.getState().setDisplayOption('showRoom', false);
    });
    render(<InlineOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    expect(screen.getByRole('switch', { name: 'แสดงห้อง' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'แสดงกลุ่มเรียน' })).toBeChecked();
  });

  it('offers only the switches the fit can still change', () => {
    render(<InlineOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    expect(screen.getAllByRole('switch').map((s) => s.textContent)).toEqual([
      'แสดงห้อง',
      'แสดงกลุ่มเรียน',
      'แสดงรหัสวิชา',
      'แสดงตารางสอบ',
    ]);
  });

  it.each([
    ['th', 'ตัวเลือกการแสดงผล', 'ชื่อวิชา', 'ไทย'],
    ['en', 'Display options', 'Subject names', 'English'],
  ] as const)(
    'selects the panel language as the name language while unset (%s)',
    (language, trigger, group, selected) => {
      act(() => {
        uiStore.getState().setLanguage(language);
      });
      render(<InlineOptions />);
      fireEvent.click(screen.getByRole('button', { name: trigger }));
      const names = screen.getByRole('group', { name: group });
      expect(
        within(names).getByRole('button', { name: selected }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(uiStore.getState().displayOptions.nameLanguage).toBeUndefined();
    },
  );

  it('stores the chosen name language and notes the fit under both', () => {
    render(<InlineOptions />);
    fireEvent.click(screen.getByRole('button', { name: 'ตัวเลือกการแสดงผล' }));
    const names = screen.getByRole('group', { name: 'ชื่อวิชา' });
    expect(screen.queryByText(/ชื่อภาษาที่สองแสดงในคาบที่มีพื้นที่พอ/)).toBeNull();
    fireEvent.click(within(names).getByRole('button', { name: 'ทั้งสองภาษา' }));
    expect(uiStore.getState().displayOptions.nameLanguage).toBe('both');
    expect(screen.getByText(/ชื่อภาษาที่สองแสดงในคาบที่มีพื้นที่พอ/)).toBeInTheDocument();
    fireEvent.click(within(names).getByRole('button', { name: 'อังกฤษ' }));
    expect(uiStore.getState().displayOptions.nameLanguage).toBe('en');
    // An explicit choice holds when the panel language changes.
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(uiStore.getState().displayOptions.nameLanguage).toBe('en');
  });
});

describe('DisplayOptions below 640 px', () => {
  beforeEach(() => {
    installViewport(390);
  });

  function renderInPanel() {
    render(
      <PanelPortalContext.Provider value={document.body}>
        <DisplayOptionsSheet />
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
