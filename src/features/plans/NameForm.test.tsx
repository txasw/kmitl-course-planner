import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { PLAN_NAME_MAX } from '@/lib/domain/plan';
import { NameForm, toOneLine } from './NameForm';
import { fitFieldHeight } from './useGrowingField';

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('ตาราง 1/2569');
  return (
    <NameForm
      value={value}
      label="ชื่อตาราง"
      save="บันทึก"
      cancel="ยกเลิก"
      onChange={setValue}
      onSubmit={onSubmit}
      onCancel={() => undefined}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe('toOneLine', () => {
  it('turns each line break into a space', () => {
    expect(toOneLine('ตาราง\nเช้า\r\nบ่าย\rเย็น')).toBe('ตาราง เช้า บ่าย เย็น');
  });

  it('leaves a name without a line break as it is', () => {
    expect(toOneLine('Plan 1/2569')).toBe('Plan 1/2569');
  });
});

describe('fitFieldHeight', () => {
  // jsdom lays nothing out, so the content height and the border frame are stubbed.
  it('sets the height to the whole value plus the borders', () => {
    const field = document.createElement('textarea');
    Object.defineProperty(field, 'scrollHeight', { value: 62 });
    Object.defineProperty(field, 'offsetHeight', { value: 30 });
    Object.defineProperty(field, 'clientHeight', { value: 28 });
    fitFieldHeight(field);
    expect(field.style.height).toBe('64px');
  });
});

describe('NameForm', () => {
  it('names the plan in a text area that grows rather than a one line input', () => {
    render(<Harness onSubmit={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'ชื่อตาราง' });
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '1');
    expect(field).toHaveAttribute('maxlength', String(PLAN_NAME_MAX));
    expect(field).toHaveClass('resize-none', 'overflow-hidden');
  });

  it('saves on Enter without adding a line', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const field = screen.getByRole('textbox', { name: 'ชื่อตาราง' });
    const enter = fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // A prevented keydown stops the browser from inserting the line break.
    expect(enter).toBe(false);
    expect(field).toHaveValue('ตาราง 1/2569');
  });

  it('keeps a pasted name on one line', () => {
    render(<Harness onSubmit={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'ชื่อตาราง' });
    fireEvent.change(field, { target: { value: 'ตาราง\nเช้า' } });
    expect(field).toHaveValue('ตาราง เช้า');
  });

  it('counts the characters against the cap', () => {
    render(<Harness onSubmit={() => undefined} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'ชื่อตาราง' }), {
      target: { value: 'ก'.repeat(42) },
    });
    expect(screen.getByText(`42/${String(PLAN_NAME_MAX)}`)).toBeInTheDocument();
  });
});
