import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { Combobox, type ComboboxOption } from './Combobox';
import { PanelPortalContext } from '../shell/PanelPortalContext';

const OPTIONS: ComboboxOption[] = [
  { value: '01', label: 'Engineering' },
  { value: '02', label: 'Architecture' },
  { value: '05', label: 'Science' },
];

afterEach(cleanup);

function setup(value = '') {
  const onChange = vi.fn();
  render(
    <Combobox
      label="Faculty"
      value={value}
      options={OPTIONS}
      placeholder="Select"
      disabled={false}
      onChange={onChange}
    />,
  );
  return { onChange, input: screen.getByRole('combobox', { name: 'Faculty' }) };
}

describe('Combobox', () => {
  it('opens on focus and lists every option', () => {
    const { input } = setup();
    fireEvent.focus(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('filters options by the typed text', () => {
    const { input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sci' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Science');
  });

  it('selects an option by pointer and reports its value', () => {
    const { onChange, input } = setup();
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Architecture' }));
    expect(onChange).toHaveBeenCalledWith('02');
  });

  it('selects an option by keyboard', () => {
    const { onChange, input } = setup();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('02');
  });

  it('commits nothing on Enter before any option is highlighted', () => {
    const { onChange, input } = setup();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the filter when the open input is clicked again', () => {
    const { input } = setup();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sci' } });
    fireEvent.click(input);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Science');
  });

  it('closes on Escape without selecting', () => {
    const { onChange, input } = setup();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the selected label while closed', () => {
    const { input } = setup('05');
    expect(input).toHaveValue('Science');
  });

  it('has no serious accessibility violations while open', async () => {
    const { container } = render(
      <Combobox
        label="Faculty"
        value=""
        options={OPTIONS}
        placeholder="Select"
        disabled={false}
        onChange={() => undefined}
      />,
    );
    fireEvent.focus(screen.getByRole('combobox', { name: 'Faculty' }));
    await expectNoSeriousA11yViolations(container);
  });

  it('renders its listbox through the panel portal when a portal root is provided', () => {
    const portal = document.createElement('div');
    document.body.appendChild(portal);
    render(
      <PanelPortalContext.Provider value={portal}>
        <Combobox
          label="Faculty"
          value=""
          options={OPTIONS}
          placeholder="Select"
          disabled={false}
          onChange={() => undefined}
        />
      </PanelPortalContext.Provider>,
    );
    fireEvent.focus(screen.getByRole('combobox', { name: 'Faculty' }));
    expect(portal.contains(screen.getByRole('listbox'))).toBe(true);
  });
});

describe('Combobox select only mode', () => {
  function setupSimple(value = '') {
    const onChange = vi.fn();
    render(
      <Combobox
        label="Credits"
        value={value}
        options={OPTIONS}
        placeholder="Any"
        disabled={false}
        searchable={false}
        onChange={onChange}
      />,
    );
    return {
      onChange,
      trigger: screen.getByRole('combobox', { name: 'Credits' }),
    };
  }

  it('renders a trigger with the selected label and no text input', () => {
    const { trigger } = setupSimple('05');
    expect(trigger.tagName).toBe('DIV');
    expect(trigger).toHaveTextContent('Science');
  });

  it('opens on ArrowDown and lists every option without a filter box', () => {
    const { trigger } = setupSimple();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('selects an option by keyboard', () => {
    const { onChange, trigger } = setupSimple();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('01');
  });

  it('opens and commits the highlighted option with Space', () => {
    const { onChange, trigger } = setupSimple();
    fireEvent.keyDown(trigger, { key: ' ' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith('01');
  });
});
