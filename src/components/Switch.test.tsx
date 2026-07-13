import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { expectNoSeriousA11yViolations } from '../../tests/support/axe';
import { Switch } from './Switch';

afterEach(cleanup);

describe('Switch', () => {
  it('exposes the checked state through the switch role', () => {
    render(<Switch checked label="Hide full" onChange={() => undefined} />);
    expect(screen.getByRole('switch', { name: 'Hide full' })).toBeChecked();
  });

  it('exposes the unchecked state', () => {
    render(
      <Switch checked={false} label="Hide full" onChange={() => undefined} />,
    );
    expect(screen.getByRole('switch', { name: 'Hide full' })).not.toBeChecked();
  });

  it('reports the toggled value on activation', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} label="Hide full" onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Hide full' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled and reads as disabled', () => {
    const onChange = vi.fn();
    render(
      <Switch
        checked
        label="Show English names"
        disabled
        onChange={onChange}
      />,
    );
    const control = screen.getByRole('switch', { name: 'Show English names' });
    expect(control).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reveals its tooltip on focus', () => {
    render(
      <Switch
        checked
        label="Show English names"
        disabled
        tooltip="Names already show in English"
        onChange={() => undefined}
      />,
    );
    fireEvent.focus(screen.getByRole('switch', { name: 'Show English names' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Names already show in English',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Switch checked label="Hide full" onChange={() => undefined} />,
    );
    await expectNoSeriousA11yViolations(container);
  });
});
