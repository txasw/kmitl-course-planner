import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { BlockContextMenu } from './BlockContextMenu';

const t = createTranslator('th');

afterEach(cleanup);

function setup(
  overrides: Partial<Parameters<typeof BlockContextMenu>[0]> = {},
) {
  const props = {
    teachTableId: 's1',
    x: 100,
    y: 120,
    t,
    onClose: vi.fn(),
    onRemove: vi.fn(),
    onDetails: vi.fn(),
    ...overrides,
  };
  render(<BlockContextMenu {...props} />);
  return props;
}

describe('BlockContextMenu', () => {
  it('renders the details and remove actions', () => {
    setup();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(
      screen.getByRole('menuitem', { name: /รายละเอียด/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /นำออก/ })).toBeInTheDocument();
  });

  it('positions itself as a fixed menu at the pointer', () => {
    setup();
    expect(screen.getByRole('menu')).toHaveStyle({ position: 'fixed' });
  });

  it('remove dispatches onRemove with the teachTableId', () => {
    const { onRemove } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /นำออก/ }));
    expect(onRemove).toHaveBeenCalledWith('s1');
  });

  it('details calls onDetails', () => {
    const { onDetails } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /รายละเอียด/ }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it('Escape closes only the menu', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses on an outside press', () => {
    const { onClose } = setup();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('has no serious accessibility violations', async () => {
    const { container } = render(
      <BlockContextMenu
        teachTableId="s1"
        x={10}
        y={10}
        t={t}
        onClose={() => undefined}
        onRemove={() => undefined}
        onDetails={() => undefined}
      />,
    );
    await expectNoSeriousA11yViolations(container);
  });
});
