import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { Layout, DRAWER_ID } from './Layout';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setDrawer(false);
    uiStore.getState().setLanguage('th');
  });
});

describe('Layout', () => {
  it('renders empty states for the three regions', () => {
    render(<Layout />);
    expect(
      screen.getByRole('heading', { name: 'ค้นหารายวิชา' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'ตารางยังว่าง' }),
    ).toBeInTheDocument();
    // The inline catalog empty state is visible; the drawer copy is aria-hidden
    // while closed, so only one is in the accessibility tree.
    expect(
      screen.getByRole('heading', { name: 'ยังไม่มีรายวิชา' }),
    ).toBeInTheDocument();
  });

  it('keeps the catalog drawer hidden until it is opened', () => {
    const { container } = render(<Layout />);
    const drawer = container.querySelector(`#${DRAWER_ID}`);
    expect(drawer).toHaveAttribute('aria-hidden', 'true');

    act(() => {
      uiStore.getState().setDrawer(true);
    });
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(
      screen.getByRole('button', { name: 'ปิดรายการรายวิชา' }),
    ).toBeInTheDocument();
  });

  it('closes the drawer from its backdrop', () => {
    render(<Layout />);
    act(() => {
      uiStore.getState().setDrawer(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'ปิดรายการรายวิชา' }));
    expect(uiStore.getState().drawerOpen).toBe(false);
  });
});
