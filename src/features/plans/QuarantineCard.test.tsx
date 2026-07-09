import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { storageIssueStore } from './storageIssueStore';
import { QuarantineCard } from './QuarantineCard';

afterEach(() => {
  cleanup();
  act(() => {
    storageIssueStore.getState().setIssue(null);
  });
});

describe('QuarantineCard', () => {
  it('renders nothing without a storage issue', () => {
    const { container } = render(<QuarantineCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the refused message with no export action', () => {
    act(() => {
      storageIssueStore
        .getState()
        .setIssue({ kind: 'refused', reason: 'newer' });
    });
    render(<QuarantineCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'คัดลอกข้อมูลที่กันไว้' }),
    ).toBeNull();
  });

  it('copies the quarantined data on the export action', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    act(() => {
      storageIssueStore
        .getState()
        .setIssue({ kind: 'quarantined', data: '{"a":1}' });
    });
    render(<QuarantineCard />);
    fireEvent.click(
      screen.getByRole('button', { name: 'คัดลอกข้อมูลที่กันไว้' }),
    );
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
  });
});
