import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { Header } from './Header';
import { uiStore } from './uiStore';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
  });
});

describe('Header', () => {
  it('renders the title, plan placeholder, and language toggle', () => {
    render(<Header titleId="title" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'title',
    );
    expect(screen.getByRole('button', { name: 'เลือกตาราง' })).toBeDisabled();
    expect(
      screen.getByRole('group', { name: 'เลือกภาษา' }),
    ).toBeInTheDocument();
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
    render(<Header titleId="title" />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(uiStore.getState().language).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
