import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Search } from 'lucide-react';
import { EmptyState, EmptyStateAction } from './EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    expect(
      screen.getByRole('heading', { name: 'No data' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Try a search.')).toBeInTheDocument();
  });

  it('renders an action when one is given', () => {
    render(
      <EmptyState
        icon={Search}
        title="No data"
        description="Try a search."
        action={<button type="button">Retry</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('fills its region with no surface of its own and a neutral icon disc', () => {
    const { container } = render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    const root = container.querySelector('[data-empty-state]');
    expect(root).toHaveClass('h-full');
    expect(root).not.toHaveClass('border', 'bg-surface', 'shadow-kcp');
    expect(root?.querySelector('span')).toHaveClass(
      'bg-surface-alt',
      'text-ink-soft',
    );
  });

  it('omits the action when none is given', () => {
    render(
      <EmptyState icon={Search} title="No data" description="Try a search." />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptyStateAction', () => {
  it('is a neutral button at the target size that runs its handler', () => {
    let pressed = 0;
    render(
      <EmptyStateAction
        label="Go to courses"
        onClick={() => {
          pressed += 1;
        }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Go to courses' });
    expect(button).toHaveAttribute('type', 'button');
    // The mockup draws an empty state's way out as a bordered neutral button, so the
    // orange stays for the accents rather than for every empty region.
    expect(button).toHaveClass('border', 'border-border', 'text-ink');
    expect(button).not.toHaveClass('bg-primary-strong');
    expect(button).toHaveClass('pointer-events-auto');
    expect(button.className).toContain('min-w-(--kcp-target-min)');
    fireEvent.click(button);
    expect(pressed).toBe(1);
  });

  it('is a borderless text button as a ghost, and filled as a primary', () => {
    render(
      <>
        <EmptyStateAction
          label="Show the week"
          variant="ghost"
          onClick={noop}
        />
        <EmptyStateAction label="Retry" variant="primary" onClick={noop} />
      </>,
    );
    const ghost = screen.getByRole('button', { name: 'Show the week' });
    expect(ghost).toHaveClass('text-primary-strong');
    expect(ghost).not.toHaveClass('border', 'bg-primary-strong');
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveClass(
      'bg-primary-strong',
      'text-surface',
    );
  });
});

function noop(): void {
  // The press itself is not under test here.
}

// Brief 8.2: every empty state is the shared component with an icon, one sentence, and
// one action. The inventory lists each file that renders it with the count of its uses, so
// a new empty state is added here on purpose, and every use passes an action. The preview
// poster is the one surface without one: its notice comes through GridEmptyState, which
// passes the action only to the edit grid, since a shared picture carries no control.
const EMPTY_STATE_INVENTORY: Readonly<Record<string, number>> = {
  'components/PanelRecoveryCard.tsx': 1,
  'features/catalog/CatalogPanel.tsx': 3,
  'features/catalog/CourseCatalog.tsx': 1,
  'features/catalog/SectionComparisonSheet.tsx': 1,
  'features/catalog/SuggestNeedsSearch.tsx': 1,
  'features/planner/GridEmptyState.tsx': 1,
  'features/planner/SelectedCoursesList.tsx': 1,
  'features/planner/SuggestDialog.tsx': 1,
  'features/planner/SummaryView.tsx': 1,
  'features/regis/DockContent.tsx': 1,
};

const SRC_DIR = resolve(process.cwd(), 'src');

function componentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return componentFiles(full);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [full] : [];
  });
}

/** Each JSX use of the component, from its opening tag to its self closing end. */
function emptyStateUses(source: string): string[] {
  return [...source.matchAll(/^(\s*)<EmptyState\b[\s\S]*?^\1\/>/gm)].map(
    (match) => match[0],
  );
}

describe('EmptyState inventory', () => {
  it('lists every file that renders an empty state', () => {
    const found: Record<string, number> = {};
    for (const file of componentFiles(SRC_DIR)) {
      const uses = emptyStateUses(readFileSync(file, 'utf8')).length;
      if (uses > 0) {
        found[relative(SRC_DIR, file).split(sep).join('/')] = uses;
      }
    }
    expect(found).toEqual(EMPTY_STATE_INVENTORY);
  });

  it('gives every use its one action', () => {
    for (const file of Object.keys(EMPTY_STATE_INVENTORY)) {
      const source = readFileSync(join(SRC_DIR, file), 'utf8');
      for (const use of emptyStateUses(source)) {
        expect(use, file).toMatch(/\baction=\{/);
      }
    }
  });
});
