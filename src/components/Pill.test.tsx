import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Check } from 'lucide-react';
import { Pill } from './Pill';

afterEach(cleanup);

describe('Pill', () => {
  it('renders a plain pill with its label', () => {
    render(<Pill tone="success">Added</Pill>);
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('keeps the label in the tree and offers a tooltip when given an icon', async () => {
    render(
      <Pill tone="success" icon={<Check size={12} aria-hidden />}>
        Added
      </Pill>,
    );
    // The label stays in the accessibility tree even where it collapses visually.
    const label = screen.getByText('Added');
    expect(label).toBeInTheDocument();
    // Hovering the collapsible pill reveals the label in a tooltip. mouseenter does not
    // bubble, so it targets the trigger span, the label's parent, not the label itself.
    const trigger = label.parentElement;
    expect(trigger).not.toBeNull();
    if (trigger !== null) {
      fireEvent.mouseEnter(trigger);
    }
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Added');
  });

  it('uses an explicit label for the tooltip over the children', async () => {
    render(
      <Pill
        tone="success"
        icon={<Check size={12} aria-hidden />}
        label="Open, 12 seats left"
      >
        Open 12
      </Pill>,
    );
    const trigger = screen.getByText('Open 12').parentElement;
    expect(trigger).not.toBeNull();
    if (trigger !== null) {
      fireEvent.mouseEnter(trigger);
    }
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Open, 12 seats left',
    );
  });
});
