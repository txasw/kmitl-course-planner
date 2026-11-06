import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import type * as DndKit from '@dnd-kit/core';
import type { UseDroppableArguments } from '@dnd-kit/core';
import { SearchDepsProvider } from '@/features/search/SearchDepsContext';
import { CatalogColumn } from '@/features/shell/CatalogColumn';
import { CATALOG_COLUMN_ID } from '@/features/shell/catalogVisibility';
import { uiStore } from '@/features/shell/uiStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { fakeSearchDeps } from '../../../tests/support/searchDeps';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { installViewport } from '../../../tests/support/viewport';
import { dragStore } from './dragStore';
import {
  CatalogRemoveZone,
  REMOVE_CATALOG_ID,
  RemoveBar,
  isRemoveZoneId,
  removeZoneForm,
} from './RemoveZone';

// jsdom has no pointer geometry, so the over state a drag would give a zone is set
// through this list of ids the mocked droppable reports as over.
const overIds = vi.hoisted(() => new Set<string | number>());

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKit>();
  return {
    ...actual,
    useDroppable: (args: UseDroppableArguments) => ({
      ...actual.useDroppable(args),
      isOver: overIds.has(args.id),
    }),
  };
});

const placed = makeSection({ teachTableId: 'b1', subjectId: '90000001' });

function startBlockDrag(): void {
  act(() => {
    dragStore.getState().startBlockMove(placed, [placed], null);
  });
}

// The panel body in miniature: the column and the bar slot, as Layout mounts them.
function Body() {
  const tier = useLayoutTier();
  return (
    <SearchDepsProvider value={fakeSearchDeps()}>
      <DndContext>
        <CatalogColumn tier={tier} />
        <RemoveBar tier={tier} />
      </DndContext>
    </SearchDepsProvider>
  );
}

function zones(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-remove-zone]')];
}

function column(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>(`#${CATALOG_COLUMN_ID}`);
  if (node === null) throw new Error('the catalog column is not rendered');
  return node;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  overIds.clear();
  act(() => {
    uiStore.getState().setCatalogVisible(true);
    dragStore.getState().clearActive();
    dragStore.getState().clearBlockMove();
  });
});

describe('removeZoneForm', () => {
  it.each(['lg', 'xl', '2xl'] as const)(
    'is the column on the %s tier while the column is shown',
    (tier) => {
      expect(removeZoneForm(tier, true)).toBe('column');
      expect(removeZoneForm(tier, false)).toBe('bar');
    },
  );

  it.each(['compact', 'medium'] as const)(
    'is the bar on the %s tier whatever the docked choice',
    (tier) => {
      expect(removeZoneForm(tier, true)).toBe('bar');
      expect(removeZoneForm(tier, false)).toBe('bar');
    },
  );
});

describe('isRemoveZoneId', () => {
  it('matches every remove prefixed id and nothing else', () => {
    expect(isRemoveZoneId(REMOVE_CATALOG_ID)).toBe(true);
    expect(isRemoveZoneId('kcp-planner-drop')).toBe(false);
    expect(isRemoveZoneId('cand-kcp-remove-x')).toBe(false);
    expect(isRemoveZoneId(7)).toBe(false);
    expect(isRemoveZoneId(undefined)).toBe(false);
  });
});

describe('CatalogRemoveZone', () => {
  function renderZone() {
    return render(
      <DndContext>
        <CatalogRemoveZone />
      </DndContext>,
    );
  }

  it('rests as a dashed frame over the zone fill with the drop label', () => {
    const { container } = renderZone();
    const [zone] = zones(container);
    expect(zone).toHaveAttribute('data-remove-zone', 'column');
    expect(zone).toHaveClass('pointer-events-none', 'absolute', 'inset-0');
    expect(zone?.querySelector('.bg-danger-zone')).toHaveClass(
      'mix-blend-multiply',
    );
    expect(zone?.querySelector('.border-dashed')).toHaveClass(
      'border-2',
      'border-danger',
      'inset-2',
    );
    const label = screen.getByText('วางที่นี่เพื่อนำออกจากตาราง');
    expect(label).toHaveClass('bg-surface', 'text-danger');
    expect(label.querySelector('svg')).toHaveAttribute('width', '24');
  });

  it('turns solid with the release label while a block is over it', () => {
    overIds.add(REMOVE_CATALOG_ID);
    const { container } = renderZone();
    const [zone] = zones(container);
    expect(zone).toHaveAttribute('data-over', 'true');
    expect(zone?.querySelector('.bg-danger-zone-over')).not.toBeNull();
    expect(zone?.querySelector('.border-solid')).not.toBeNull();
    const label = screen.getByText('ปล่อยเพื่อนำออก');
    expect(label).toHaveClass('bg-danger', 'text-surface');
    expect(label.querySelector('svg')).toHaveAttribute('width', '24');
  });
});

describe('remove zone forms in the panel body', () => {
  it('turns the shown docked column into the zone and dims its content', () => {
    installViewport(1440);
    const { container } = render(<Body />);
    expect(zones(container)).toHaveLength(0);

    startBlockDrag();
    const [zone, ...rest] = zones(container);
    expect(rest).toHaveLength(0);
    expect(zone).toHaveAttribute('data-remove-zone', 'column');
    expect(zone?.parentElement).toBe(column(container));
    expect(column(container)).toHaveClass(
      '[&>:not([data-remove-zone],[data-catalog-shadow])]:opacity-30',
    );

    act(() => {
      dragStore.getState().clearBlockMove();
    });
    expect(zones(container)).toHaveLength(0);
    expect(column(container)).not.toHaveClass(
      '[&>:not([data-remove-zone],[data-catalog-shadow])]:opacity-30',
    );
  });

  it('never makes the hidden docked column a zone', () => {
    installViewport(1440);
    act(() => {
      uiStore.getState().setCatalogVisible(false);
    });
    const { container } = render(<Body />);
    startBlockDrag();
    expect(column(container).querySelector('[data-remove-zone]')).toBeNull();
    expect(zones(container)).toHaveLength(1);
  });

  it.each([390, 768])(
    'leaves the column alone at %i px, below the dock',
    (width) => {
      installViewport(width);
      const { container } = render(<Body />);
      startBlockDrag();
      expect(column(container).querySelector('[data-remove-zone]')).toBeNull();
      expect(zones(container)).toHaveLength(1);
    },
  );

  it('shows no zone for a drag that is not a block drag', () => {
    installViewport(1440);
    const { container } = render(<Body />);
    act(() => {
      dragStore
        .getState()
        .start(
          makeCourse({ subjectId: placed.subjectId, sections: [placed] }),
          placed,
          [],
        );
    });
    expect(zones(container)).toHaveLength(0);
  });
});
