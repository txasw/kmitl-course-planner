import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { Header } from './Header';
import { uiStore } from './uiStore';
import { CATALOG_COLUMN_ID } from './catalogVisibility';
import { installViewport } from '../../../tests/support/viewport';
import { makePlan } from '../../../tests/support/domain-builders';
import { resetPlanStore } from '../../../tests/support/plan-store';
import { planStore } from '@/features/plans/planStore';
import {
  autosaveStore,
  SAVE_INDICATOR_ID,
} from '@/features/plans/autosaveStore';
import { TARGET_SIZE } from '@/lib/ui/target';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetPlanStore();
  act(() => {
    autosaveStore.getState().detach();
    uiStore.getState().close();
    uiStore.getState().setCatalogVisible(true);
    uiStore.getState().setLanguage('th');
  });
});

describe('Header', () => {
  it('renders the title, plan switcher, and language toggle from lg', () => {
    installViewport(1024);
    render(<Header titleId="title" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'title',
    );
    expect(
      screen.getByRole('button', { name: 'เลือกตาราง' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'เลือกภาษา' }),
    ).toBeInTheDocument();
  });

  it('keeps the title labelling the dialog while it is visually hidden below lg', () => {
    render(<Header titleId="title" />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('KCP: ตัววางแผนตารางเรียน สจล.');
    expect(title).toHaveClass('sr-only', 'lg:not-sr-only');
  });

  it('lays out one row whose leading group alone shrinks', () => {
    const { container } = render(<Header titleId="title" />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('flex', 'h-14', 'items-center');
    expect(header).not.toHaveClass('flex-wrap');
    const [leading, trailing] = Array.from(header?.children ?? []);
    expect(leading).toHaveClass('min-w-0', 'flex-1');
    expect(trailing).toHaveClass('shrink-0');
  });

  it('renders close as the last control and never shrinks it', () => {
    const { container } = render(<Header titleId="title" />);
    const buttons = container.querySelectorAll('header button');
    const last = buttons[buttons.length - 1];
    expect(last).toBe(screen.getByRole('button', { name: 'ปิด' }));
    expect(last).toHaveClass('shrink-0');
    for (const token of TARGET_SIZE.split(' ')) {
      expect(last).toHaveClass(token);
    }
  });

  it('shows the active plan name with its term under it', () => {
    act(() => {
      planStore
        .getState()
        .hydrate([
          makePlan({ id: 'a', name: 'แผนหลัก', year: '2569', semester: '1' }),
        ]);
    });
    render(<Header titleId="title" />);
    const trigger = screen.getByRole('button', { name: 'เลือกตาราง' });
    expect(trigger).toHaveTextContent('แผนหลัก');
    expect(trigger).toHaveTextContent('ภาคการศึกษา 1/2569');
  });

  it('shows the save state beside the plan switcher once autosave runs', () => {
    const { container } = render(<Header titleId="title" />);
    expect(document.getElementById(SAVE_INDICATOR_ID)).toBeNull();
    act(() => {
      planStore.getState().hydrate([makePlan({ id: 'a' })]);
      autosaveStore.getState().attach(vi.fn());
    });
    const indicator = document.getElementById(SAVE_INDICATOR_ID);
    expect(indicator).toHaveTextContent('บันทึกแล้ว');
    const leading = container.querySelector('header')?.firstElementChild;
    expect(indicator?.parentElement).toBe(leading);
    // The plan switcher sits right before it in the leading group.
    expect(indicator?.previousElementSibling).toContainElement(
      screen.getByRole('button', { name: 'เลือกตาราง' }),
    );
  });

  it('closes the overlay from the close control', () => {
    act(() => {
      uiStore.getState().open();
    });
    render(<Header titleId="title" />);
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(uiStore.getState().isOpen).toBe(false);
  });

  it('switches the language through the toggle', () => {
    installViewport(1024);
    render(<Header titleId="title" />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(uiStore.getState().language).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('moves the language choice into the overflow menu below lg', () => {
    installViewport(1023);
    render(<Header titleId="title" />);
    expect(
      screen.queryByRole('group', { name: 'เลือกภาษา' }),
    ).not.toBeInTheDocument();
    const more = screen.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' });
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(uiStore.getState().language).toBe('en');
  });

  it('swaps the overflow menu for the toggle when the panel widens', () => {
    const viewport = installViewport(768);
    render(<Header titleId="title" />);
    expect(
      screen.getByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }),
    ).toBeInTheDocument();
    act(() => {
      viewport.resize(1024);
    });
    expect(
      screen.queryByRole('button', { name: 'ตัวเลือกเพิ่มเติม' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'เลือกภาษา' }),
    ).toBeInTheDocument();
  });

  it('toggles the catalog sheet below the lg tier', () => {
    installViewport(768);
    render(<Header titleId="title" />);
    const toggle = screen.getByRole('button', { name: 'รายวิชา' });
    expect(toggle).toHaveAttribute('aria-controls', CATALOG_COLUMN_ID);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(uiStore.getState().sheetOpen).toBe(true);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(uiStore.getState().sheetOpen).toBe(false);
  });

  it('drops the sheet toggle where the catalog column is docked', () => {
    installViewport(1024);
    render(<Header titleId="title" />);
    expect(
      screen.queryByRole('button', { name: 'รายวิชา' }),
    ).not.toBeInTheDocument();
  });

  it('leaves a hidden docked column to the edge rail', () => {
    installViewport(1024);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    render(<Header titleId="title" />);
    expect(
      screen.queryByRole('button', { name: 'รายวิชา' }),
    ).not.toBeInTheDocument();
  });
});
