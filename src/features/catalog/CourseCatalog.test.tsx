import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  resetPlanStore,
  seedActivePlan,
} from '../../../tests/support/plan-store';
import {
  normalizeTeachTable,
  type NormalizedCatalog,
} from '@/lib/domain/normalize';
import type { TeachTableQuery } from '@/lib/messaging/protocol';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { dragStore } from '@/features/planner/dragStore';
import { EMPTY_DISCLOSURE } from '@/lib/catalog/cardDisclosure';
import { catalogStore } from './catalogStore';
import { CourseCatalog } from './CourseCatalog';

// A search context in the plan's own term (2569 semester 1) so an add stamps a
// matching source query rather than the term-less fallback.
const SEARCH_QUERY: TeachTableQuery = {
  mode: 'by_subject_id',
  selected_year: '2569',
  selected_semester: '1',
  search_all_faculty: true,
  search_all_department: true,
  search_all_curriculum: true,
  search_all_class_year: true,
  selected_subject_id: '90000000',
};

function ownerCatalog(): NormalizedCatalog {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_subject_owner_id-32.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  return result.value;
}

const catalog = ownerCatalog();

function cardToggle(subjectId: string): HTMLElement {
  const article = screen
    .getAllByRole('article')
    .find((node) => node.textContent.includes(subjectId));
  const node = article?.querySelector<HTMLElement>('[data-course-toggle]');
  if (node == null) throw new Error(`no card toggle for ${subjectId}`);
  return node;
}

/** Opens every collapsed card, as a student does before adding from its rows. */
function expandAll(): void {
  for (const node of document.querySelectorAll<HTMLElement>(
    '[data-course-toggle][aria-expanded="false"]',
  )) {
    fireEvent.click(node);
  }
}

beforeEach(() => {
  act(() => {
    catalogStore.getState().resetFilter();
    catalogStore.setState({ disclosure: EMPTY_DISCLOSURE });
    searchStore.setState({ resultQuery: SEARCH_QUERY });
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    resetPlanStore();
    searchStore.setState({ resultQuery: null });
    dragStore.setState({
      active: null,
      blocked: null,
      crossTerm: null,
      announcement: null,
    });
  });
});

describe('CourseCatalog', () => {
  it('reports the dedupe summary from the normalized totals', () => {
    const { container } = render(
      <CourseCatalog catalog={catalog} onRefresh={() => undefined} />,
    );
    // The owner 32 capture dedupes 13 raw rows to 4 sections across 3 courses.
    expect(container.textContent).toContain('3 รายวิชา');
    expect(container.textContent).toContain('4 กลุ่มเรียน');
    expect(container.textContent).toContain('9 รายการซ้ำที่รวมแล้ว');
    // No section here has extra meetings, so the multi meeting count is hidden.
    expect(container.textContent).not.toContain('กลุ่มเรียนหลายคาบ');
  });

  it('reports the multi meeting count when sections carry extra meetings', () => {
    const result = normalizeTeachTable(
      loadFixture('teach-table.multi-meeting.capture.json'),
    );
    if (!result.ok) {
      throw new Error('fixture failed to normalize');
    }
    const { container } = render(
      <CourseCatalog catalog={result.value} onRefresh={() => undefined} />,
    );
    expect(container.textContent).toContain('6 กลุ่มเรียนหลายคาบ');
  });

  it('invokes the refresh callback from the refresh control', () => {
    const onRefresh = vi.fn();
    render(<CourseCatalog catalog={catalog} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'รีเฟรช' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders the deduped courses under their subject type heading', () => {
    // After dedupe every owner 32 subject resolves to the GenEd heading.
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expect(
      screen.getByRole('heading', { name: /กลุ่ม 1/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('90592033')).toBeInTheDocument();
  });

  it('splits courses into separate heading groups', () => {
    const multiGroup: NormalizedCatalog = {
      duplicateCount: 0,
      multiMeetingCount: 0,
      warnings: [],
      courses: [
        makeCourse({
          subjectId: '90000001',
          groupNameTh: 'กลุ่มเอ',
          groupNameEn: 'Group A',
        }),
        makeCourse({
          subjectId: '90000002',
          groupNameTh: 'กลุ่มบี',
          groupNameEn: 'Group B',
        }),
      ],
    };
    render(<CourseCatalog catalog={multiGroup} onRefresh={() => undefined} />);
    expect(
      screen.getByRole('heading', { name: 'กลุ่มเอ' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'กลุ่มบี' }),
    ).toBeInTheDocument();
  });

  it('filters the courses by free text', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.change(screen.getByRole('searchbox', { name: 'กรองรายการ' }), {
      target: { value: '90592033' },
    });
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('90592033')).toBeInTheDocument();
  });

  it('adds an open section to the plan from its add button', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expandAll();
    const addButton = screen
      .getAllByRole('button', { name: /^เพิ่ม/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (addButton) {
      fireEvent.click(addButton);
    }
    expect(planStore.getState().entries.length).toBeGreaterThan(0);
  });

  it('routes a blocked add on a conflicting section to the feedback strip', () => {
    act(() => {
      seedActivePlan([
        makePlanEntry({
          snapshot: makeSnapshot({
            teachTableId: 'p1',
            subjectId: 'S1',
            section: '901',
            meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
          }),
        }),
      ]);
    });
    const conflictCatalog: NormalizedCatalog = {
      duplicateCount: 0,
      multiMeetingCount: 0,
      warnings: [],
      courses: [
        makeCourse({
          subjectId: 'S2',
          sections: [
            makeSection({
              teachTableId: 's2',
              subjectId: 'S2',
              section: '901',
              meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
            }),
          ],
        }),
      ],
    };
    render(
      <CourseCatalog catalog={conflictCatalog} onRefresh={() => undefined} />,
    );
    const addButton = screen
      .getAllByRole('button', { name: /^เพิ่ม/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (addButton) {
      fireEvent.click(addButton);
    }
    expect(dragStore.getState().blocked).not.toBeNull();
    expect(planStore.getState().entries).toHaveLength(1);
  });

  it('announces a successful add', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expandAll();
    const addButton = screen
      .getAllByRole('button', { name: /^เพิ่ม/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (addButton) {
      fireEvent.click(addButton);
    }
    expect(dragStore.getState().announcement).not.toBeNull();
  });

  it('shows the different term state, its banner, and a switch action', () => {
    // The active plan is a second semester plan; the catalog is browsed in the
    // first semester (the beforeEach search context), so every row is different term.
    act(() => {
      seedActivePlan([], { id: 'p2', year: '2569', semester: '2' });
    });
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expandAll();
    expect(screen.getAllByText('คนละภาค').length).toBeGreaterThan(0);
    // The banner names the browsed term and every add rail is disabled.
    expect(screen.getByText(/กำลังดูภาค/)).toBeInTheDocument();
    const addRails = screen.getAllByRole('button', { name: /^เพิ่ม/ });
    expect(addRails.length).toBeGreaterThan(0);
    for (const rail of addRails) {
      expect(rail).toHaveAttribute('aria-disabled', 'true');
    }
    // The switch action creates a plan for the browsed term.
    const [switchButton] = screen.getAllByRole('button', {
      name: 'สลับไปตารางภาคนี้',
    });
    if (switchButton) {
      fireEvent.click(switchButton);
    }
    const state = planStore.getState();
    const active = state.plans.find((plan) => plan.id === state.activePlanId);
    expect(active?.semester).toBe('1');
  });
});

describe('CourseCatalog card disclosure', () => {
  it('collapses every card of a multi course result', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    const toggles = document.querySelectorAll('[data-course-toggle]');
    expect(toggles).toHaveLength(3);
    for (const node of toggles) {
      expect(node).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('opens the card of a single course result', () => {
    const single: NormalizedCatalog = {
      ...catalog,
      courses: catalog.courses.slice(0, 1),
    };
    render(<CourseCatalog catalog={single} onRefresh={() => undefined} />);
    expect(document.querySelector('[data-course-toggle]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('opens a card whose subject id the text filter names exactly', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    const filterBox = screen.getByRole('searchbox', { name: 'กรองรายการ' });
    fireEvent.change(filterBox, { target: { value: '9059203' } });
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(filterBox, { target: { value: '90592033' } });
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a choice across a refresh and drops it for a new query', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    fireEvent.click(cardToggle('90592033'));
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'true');

    // A refresh stores an equal query object, so the choice holds.
    act(() => {
      searchStore.setState({ resultQuery: { ...SEARCH_QUERY } });
    });
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      searchStore.setState({
        resultQuery: { ...SEARCH_QUERY, selected_subject_id: '90592008' },
      });
    });
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses an opened card once added and keeps it collapsed after a remove', () => {
    render(<CourseCatalog catalog={catalog} onRefresh={() => undefined} />);
    expandAll();
    const addButton = screen
      .getAllByRole('button', { name: /^เพิ่ม/ })
      .find((button) => button.getAttribute('aria-disabled') !== 'true');
    if (addButton === undefined) throw new Error('expected an open section');
    const article = addButton.closest('article');
    fireEvent.click(addButton);
    const added = article?.querySelector('[data-course-toggle]');
    expect(added).toHaveAttribute('aria-expanded', 'false');

    const entry = planStore.getState().entries[0];
    if (entry === undefined) throw new Error('expected a plan entry');
    act(() => {
      planStore.getState().remove(entry.teachTableId);
    });
    expect(article?.querySelector('[data-course-toggle]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
