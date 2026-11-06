import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
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

  it('narrows to a pencil and an eye named by their labels below 640 px', () => {
    render(<ModeToggle />);
    const edit = screen.getByRole('button', { name: 'แก้ไข' });
    const preview = screen.getByRole('button', { name: 'ดูตัวอย่าง' });
    expect(edit.querySelector('svg.lucide-pencil')).toHaveClass('sm:hidden');
    expect(preview.querySelector('svg.lucide-eye')).toHaveClass('sm:hidden');
    expect(within(edit).getByText('แก้ไข')).toHaveClass('max-sm:sr-only');
    expect(within(preview).getByText('ดูตัวอย่าง')).toHaveClass(
      'max-sm:sr-only',
    );
  });

  it('keeps the filled look for the active mode', () => {
    render(<ModeToggle />);
    expect(screen.getByRole('button', { name: 'แก้ไข' })).toHaveClass(
      'bg-primary-strong',
    );
  });
});
