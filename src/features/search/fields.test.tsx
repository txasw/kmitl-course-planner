import { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SubjectIdInput } from './fields';

afterEach(cleanup);

// A controlled harness so the input reflects the sanitized value the way it does in the
// search rail, which is what a composition end reads back.
function Harness({
  onChange,
  onSubmit,
}: {
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <SubjectIdInput
      label="รหัสวิชา"
      value={value}
      hint="hint"
      invalid={false}
      invalidMessage="invalid"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      onSubmit={onSubmit}
    />
  );
}

function setup() {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  render(<Harness onChange={onChange} onSubmit={onSubmit} />);
  const input = screen.getByRole('textbox');
  return { onChange, onSubmit, input };
}

describe('SubjectIdInput', () => {
  it('passes only digits to onChange when letters are typed', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '12a3' } });
    expect(onChange).toHaveBeenLastCalledWith('123');
  });

  it('clamps a pasted over long value to eight digits', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '12313213123asdasd' } });
    expect(onChange).toHaveBeenLastCalledWith('12313213');
  });

  it('keeps leading zeros through onChange', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '01234567' } });
    expect(onChange).toHaveBeenLastCalledWith('01234567');
  });

  it('sanitizes on composition end for an IME commit', () => {
    const { onChange, input } = setup();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '12ก' } });
    // While composing the raw value passes through untouched.
    expect(onChange).toHaveBeenLastCalledWith('12ก');
    fireEvent.compositionEnd(input, { target: { value: '12ก' } });
    expect(onChange).toHaveBeenLastCalledWith('12');
  });

  it('shows a live digit count out of eight', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '123' } });
    expect(screen.getByText('3/8')).toBeInTheDocument();
  });

  it('routes an Enter press to onSubmit', () => {
    const { onSubmit, input } = setup();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
