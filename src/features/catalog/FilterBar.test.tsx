import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { uiStore } from '@/features/shell/uiStore';
import { catalogStore } from './catalogStore';
import { FilterBar } from './FilterBar';

const CREDIT = /หน่วยกิต|Credit/i;
const FILTER_BUTTON = /^(?:ตัวกรอง|Filters)$/;

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setLanguage('th');
  });
});
beforeEach(() => {
  catalogStore.getState().resetFilter();
});

function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: FILTER_BUTTON }));
}

describe('FilterBar', () => {
  it('names the text field by its visible label and keeps the hint as placeholder', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    const field = screen.getByLabelText('กรองรายการ');
    expect(field).toBe(screen.getByRole('searchbox', { name: 'กรองรายการ' }));
    expect(screen.getByText('กรองรายการ').tagName).toBe('LABEL');
    expect(field).toHaveAttribute('placeholder', 'ค้นหาในรายการ');
    fireEvent.change(field, { target: { value: '9059' } });
    expect(catalogStore.getState().filter.text).toBe('9059');
  });

  it('draws the text field boundary with the form control token', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    const field = screen.getByLabelText('กรองรายการ');
    expect(field).toHaveClass('border-border-strong');
    expect(field).not.toHaveClass('border-border');
  });

  it('renders the credit filter as a select only combobox in the popover', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    const trigger = screen.getByRole('combobox', { name: CREDIT });
    expect(trigger.tagName).toBe('DIV');
    expect(document.querySelector('select')).toBeNull();
  });

  it('selecting a credit option sets the numeric credit', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    fireEvent.click(screen.getByRole('combobox', { name: CREDIT }));
    fireEvent.mouseDown(screen.getByRole('option', { name: '3' }));
    expect(catalogStore.getState().filter.credit).toBe(3);
  });

  it('shows the active facet count on the filter button', () => {
    catalogStore.getState().setHideFull(true);
    catalogStore.getState().toggleDay(1);
    render(<FilterBar creditOptions={[3, 4]} />);
    expect(
      screen.getByRole('button', { name: FILTER_BUTTON }),
    ).toHaveTextContent('2');
  });

  it('removes a facet from its chip', () => {
    catalogStore.getState().setHideFull(true);
    render(<FilterBar creditOptions={[3, 4]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /(นำออก|Remove).+(เต็ม|full)/i }),
    );
    expect(catalogStore.getState().filter.hideFull).toBe(false);
  });

  it('clears every facet from the clear all chip', () => {
    catalogStore.getState().setHideFull(true);
    catalogStore.getState().toggleDay(1);
    render(<FilterBar creditOptions={[3, 4]} />);
    fireEvent.click(screen.getByRole('button', { name: /ล้างตัวกรอง|Clear/i }));
    expect(catalogStore.getState().filter.hideFull).toBe(false);
    expect(catalogStore.getState().filter.days).toHaveLength(0);
  });

  it('renders the hide facets as switches that update the store', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
    // The three hide switches are hide full, hide conflicting, and hide
    // unscheduled in order, so toggling the first sets hideFull.
    const [hideFull] = switches;
    if (hideFull === undefined) {
      throw new Error('expected the hide full switch');
    }
    fireEvent.click(hideFull);
    expect(catalogStore.getState().filter.hideFull).toBe(true);
  });

  it('labels the hide conflicting switch for time and exam clashes alike', () => {
    // The filter hides every conflicting section, exam clashes included, so its label
    // names conflicts in general rather than time conflicts only.
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    expect(
      screen.getByRole('switch', { name: 'ซ่อนรายการที่ชนกัน' }),
    ).toBeInTheDocument();
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(
      screen.getByRole('switch', { name: 'Hide conflicts' }),
    ).toBeInTheDocument();
  });

  it('has no serious accessibility violations with the popover open', async () => {
    const { container } = render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    await expectNoSeriousA11yViolations(container);
  });
});
