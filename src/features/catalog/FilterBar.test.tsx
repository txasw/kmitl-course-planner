import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { catalogStore } from './catalogStore';
import { FilterBar } from './FilterBar';

const CREDIT = /หน่วยกิต|Credit/i;

afterEach(cleanup);
beforeEach(() => {
  catalogStore.getState().resetFilter();
});

describe('FilterBar credit filter', () => {
  it('renders the credit filter as a select only combobox, not a native select', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    const trigger = screen.getByRole('combobox', { name: CREDIT });
    expect(trigger.tagName).toBe('DIV');
    expect(document.querySelector('select')).toBeNull();
  });

  it('selecting a credit option sets the numeric credit', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    fireEvent.click(screen.getByRole('combobox', { name: CREDIT }));
    fireEvent.mouseDown(screen.getByRole('option', { name: '3' }));
    expect(catalogStore.getState().filter.credit).toBe(3);
  });

  it('the any option clears the credit to null', () => {
    catalogStore.getState().setCredit(3);
    render(<FilterBar creditOptions={[3, 4]} />);
    fireEvent.click(screen.getByRole('combobox', { name: CREDIT }));
    fireEvent.mouseDown(
      screen.getByRole('option', { name: /ทุกหน่วยกิต|Any/i }),
    );
    expect(catalogStore.getState().filter.credit).toBeNull();
  });
});
