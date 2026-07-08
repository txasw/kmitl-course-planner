import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { uiStore } from './uiStore';
import { ModeToggle } from './ModeToggle';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setViewMode('edit');
  });
});

describe('ModeToggle', () => {
  it('marks edit as the default active mode', () => {
    render(<ModeToggle />);
    expect(screen.getByRole('button', { name: 'แก้ไข' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches the ui store to preview on click', () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'ดูตัวอย่าง' }));
    expect(uiStore.getState().viewMode).toBe('preview');
  });
});
