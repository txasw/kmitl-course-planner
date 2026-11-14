import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { BlockContextMenu } from './BlockContextMenu';

const t = createTranslator('th');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A stand in for the block the menu opened on, in the document like a real one. */
function anchorBlock(): HTMLElement {
  const block = document.createElement('div');
  block.tabIndex = 0;
  block.setAttribute('role', 'button');
  block.setAttribute('aria-label', 'block');
  document.body.append(block);
  return block;
}

function setup(
  overrides: Partial<Parameters<typeof BlockContextMenu>[0]> = {},
) {
  const props = {
    teachTableId: 's1',
    anchor: anchorBlock(),
    x: 100,
    y: 120,
    t,
    onClose: vi.fn(),
    onRemove: vi.fn(),
    onDetails: vi.fn(),
    onCopySubjectId: vi.fn(),
    ...overrides,
  };
  render(<BlockContextMenu {...props} />);
  return props;
}

// The menu opened on a block and closed by its own close callback, the way the planner
// panel holds it, so a close unmounts the menu.
function ClosableMenu({
  removeBlockOnClose = false,
}: {
  removeBlockOnClose?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [blockShown, setBlockShown] = useState(true);
  return (
    <>
      {blockShown ? (
        <div ref={setAnchor} role="button" tabIndex={0} aria-label="block" />
      ) : null}
      {anchor !== null ? (
        <BlockContextMenu
          teachTableId="s1"
          anchor={anchor}
          x={10}
          y={10}
          t={t}
          onClose={() => {
            if (removeBlockOnClose) setBlockShown(false);
            setAnchor(null);
          }}
          onRemove={() => undefined}
          onDetails={() => undefined}
          onCopySubjectId={() => undefined}
        />
      ) : null}
    </>
  );
}

describe('BlockContextMenu', () => {
  it('renders the details, copy subject id, and remove actions', () => {
    setup();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(
      screen.getByRole('menuitem', { name: /รายละเอียด/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'คัดลอกรหัสวิชา' }),
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

  it('copy subject id calls onCopySubjectId', () => {
    const { onCopySubjectId } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: 'คัดลอกรหัสวิชา' }));
    expect(onCopySubjectId).toHaveBeenCalledTimes(1);
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

  it('returns focus to its block when it closes', () => {
    render(<ClosableMenu />);
    const menuItem = screen.getByRole('menuitem', { name: /รายละเอียด/ });
    expect(menuItem).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'block' })).toHaveFocus();
  });

  it('leaves focus alone when the block left with the close', () => {
    render(<ClosableMenu removeBlockOnClose />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body).toHaveFocus();
  });

  it('has no serious accessibility violations', async () => {
    const { container } = render(
      <BlockContextMenu
        teachTableId="s1"
        anchor={anchorBlock()}
        x={10}
        y={10}
        t={t}
        onClose={() => undefined}
        onRemove={() => undefined}
        onDetails={() => undefined}
        onCopySubjectId={() => undefined}
      />,
    );
    await expectNoSeriousA11yViolations(container);
  });
});
