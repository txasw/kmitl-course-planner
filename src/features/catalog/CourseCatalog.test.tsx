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
import { FeedbackStrip } from '@/features/planner/FeedbackStrip';
import { createTranslator } from '@/lib/i18n/t';
import { EMPTY_DISCLOSURE } from '@/lib/catalog/cardDisclosure';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { installViewport } from '../../../tests/support/viewport';
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
    searchStore.setState({ resultQuery: null, result: { status: 'idle' } });
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
    const { container } = render(<CourseCatalog catalog={catalog} />);
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
    const { container } = render(<CourseCatalog catalog={result.value} />);
    expect(container.textContent).toContain('6 กลุ่มเรียนหลายคาบ');
  });

  it('renders the deduped courses under their subject type heading', () => {
    // After dedupe every owner 32 subject resolves to the GenEd heading.
    render(<CourseCatalog catalog={catalog} />);
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
    render(<CourseCatalog catalog={multiGroup} />);
    expect(
      screen.getByRole('heading', { name: 'กลุ่มเอ' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'กลุ่มบี' }),
    ).toBeInTheDocument();
  });

  it('filters the courses by free text', () => {
    render(<CourseCatalog catalog={catalog} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.change(screen.getByRole('searchbox', { name: 'กรองรายการ' }), {
      target: { value: '90592033' },
    });
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('90592033')).toBeInTheDocument();
  });

  it('adds an open section to the plan from its add button', () => {
    render(<CourseCatalog catalog={catalog} />);
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
    render(<CourseCatalog catalog={conflictCatalog} />);
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
    render(<CourseCatalog catalog={catalog} />);
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
    render(<CourseCatalog catalog={catalog} />);
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
    render(<CourseCatalog catalog={catalog} />);
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
    render(<CourseCatalog catalog={single} />);
    expect(document.querySelector('[data-course-toggle]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('opens a card whose subject id the text filter names exactly', () => {
    render(<CourseCatalog catalog={catalog} />);
    const filterBox = screen.getByRole('searchbox', { name: 'กรองรายการ' });
    fireEvent.change(filterBox, { target: { value: '9059203' } });
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(filterBox, { target: { value: '90592033' } });
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a choice across a refresh and drops it for a new query', () => {
    render(<CourseCatalog catalog={catalog} />);
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
    render(<CourseCatalog catalog={catalog} />);
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

describe('CourseCatalog expand all', () => {
  function bodyStages(): (string | null)[] {
    return [...document.querySelectorAll('[data-course-body]')].map((node) =>
      node.getAttribute('data-stage'),
    );
  }

  it('opens every card, then flips to collapse every card', () => {
    render(<CourseCatalog catalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: 'ขยายทั้งหมด' }));
    for (const node of document.querySelectorAll('[data-course-toggle]')) {
      expect(node).toHaveAttribute('aria-expanded', 'true');
    }
    fireEvent.click(screen.getByRole('button', { name: 'ย่อทั้งหมด' }));
    for (const node of document.querySelectorAll('[data-course-toggle]')) {
      expect(node).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('offers collapse once any visible card is open', () => {
    render(<CourseCatalog catalog={catalog} />);
    fireEvent.click(cardToggle('90592033'));
    expect(
      screen.getByRole('button', { name: 'ย่อทั้งหมด' }),
    ).toBeInTheDocument();
  });

  it('changes every card with no transition stage', () => {
    render(<CourseCatalog catalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: 'ขยายทั้งหมด' }));
    expect(bodyStages()).toEqual(['open', 'open', 'open']);
    fireEvent.click(screen.getByRole('button', { name: 'ย่อทั้งหมด' }));
    expect(bodyStages()).toEqual(['closed', 'closed', 'closed']);
  });

  it('animates a single card toggled after a bulk change, and only that card', () => {
    render(<CourseCatalog catalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: 'ขยายทั้งหมด' }));
    fireEvent.click(cardToggle('90592008'));
    expect(bodyStages()).toContain('leaving');
    expect(bodyStages().filter((stage) => stage === 'open')).toHaveLength(2);
  });

  it('acts only on the cards the filters show', () => {
    render(<CourseCatalog catalog={catalog} />);
    const filterBox = screen.getByRole('searchbox', { name: 'กรองรายการ' });
    fireEvent.change(filterBox, { target: { value: '9059200' } });
    fireEvent.click(screen.getByRole('button', { name: 'ขยายทั้งหมด' }));
    fireEvent.change(filterBox, { target: { value: '' } });
    expect(cardToggle('90592008')).toHaveAttribute('aria-expanded', 'true');
    expect(cardToggle('90592004')).toHaveAttribute('aria-expanded', 'true');
    expect(cardToggle('90592033')).toHaveAttribute('aria-expanded', 'false');
  });

  it('is hidden for a one course result', () => {
    const single: NormalizedCatalog = {
      ...catalog,
      courses: catalog.courses.slice(0, 1),
    };
    render(<CourseCatalog catalog={single} />);
    expect(
      screen.queryByRole('button', { name: /ทั้งหมด$/ }),
    ).not.toBeInTheDocument();
  });

  it('moves focus from a row to its card toggle before collapsing', () => {
    render(<CourseCatalog catalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: 'ขยายทั้งหมด' }));
    const toggleNode = cardToggle('90592008');
    const row = toggleNode
      .closest('article')
      ?.querySelector<HTMLElement>('[data-course-body] button');
    if (row == null) throw new Error('expected a focusable row control');
    row.focus();
    // fireEvent.click does not focus the control, as a click on some platforms does
    // not, so focus stays in the row until the catalog moves it.
    fireEvent.click(screen.getByRole('button', { name: 'ย่อทั้งหมด' }));
    expect(document.activeElement).toBe(toggleNode);
  });
});

describe('CourseCatalog focus', () => {
  /** The first add control a student can press on an open row. */
  function firstAddButton(): HTMLElement {
    const button = screen
      .getAllByRole('button', { name: /^เพิ่ม/ })
      .find((node) => node.getAttribute('aria-disabled') !== 'true');
    if (button === undefined) throw new Error('expected an open section');
    return button;
  }

  it('lands a keyboard add from an expanded row on the collapsed card toggle', () => {
    render(<CourseCatalog catalog={catalog} />);
    expandAll();
    const add = firstAddButton();
    const toggleId = add
      .closest('article')
      ?.querySelector('[data-course-toggle]')
      ?.getAttribute('aria-controls');
    add.focus();
    fireEvent.click(add);
    const focused = document.activeElement;
    expect(focused).toHaveAttribute('data-course-toggle');
    expect(focused).toHaveAttribute('aria-controls', toggleId);
    expect(focused).toHaveAttribute('aria-expanded', 'false');
  });

  it('lands an add over the covered timetable on the card toggle beside its toast', () => {
    installViewport(768);
    act(() => {
      uiStore.getState().setSheetOpen(true);
    });
    try {
      render(<CourseCatalog catalog={catalog} />);
      expandAll();
      const add = firstAddButton();
      const article = add.closest('article');
      add.focus();
      fireEvent.click(add);
      // The sheet stays open for the next pick, so focus stays on the card in it while
      // the toast confirms the add the covered grid cannot show.
      expect(toastStore.getState().toast).not.toBeNull();
      expect(document.activeElement).toBe(
        article?.querySelector('[data-course-toggle]'),
      );
    } finally {
      act(() => {
        uiStore.getState().setSheetOpen(false);
        toastStore.getState().dismiss();
      });
      vi.unstubAllGlobals();
    }
  });

  it('lands a grip commit on the collapsed card toggle', () => {
    render(<CourseCatalog catalog={catalog} />);
    expandAll();
    const grip = screen.getAllByRole('button', { name: /^ลากเพื่อเพิ่ม/ })[0];
    if (grip === undefined) throw new Error('expected a section grip');
    const article = grip.closest('article');
    grip.focus();
    fireEvent.click(grip);
    expect(planStore.getState().entries.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(
      article?.querySelector('[data-course-toggle]'),
    );
  });

  it('moves focus to the card toggle after a remove from the card', () => {
    render(<CourseCatalog catalog={catalog} />);
    expandAll();
    const article = firstAddButton().closest('article');
    fireEvent.click(firstAddButton());
    const remove = article?.querySelector<HTMLElement>(
      'header button[aria-label^="นำออก"]',
    );
    if (remove == null) throw new Error('expected the card remove control');
    remove.focus();
    fireEvent.click(remove);
    expect(planStore.getState().entries).toHaveLength(0);
    expect(document.activeElement).toBe(
      article?.querySelector('[data-course-toggle]'),
    );
  });

  it('moves focus to the strip action after a blocked add', () => {
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
    act(() => {
      searchStore.setState({
        result: { status: 'ready', data: conflictCatalog },
      });
    });
    render(
      <>
        <FeedbackStrip t={createTranslator('th')} />
        <CourseCatalog catalog={conflictCatalog} />
      </>,
    );
    const add = firstAddButton();
    add.focus();
    fireEvent.click(add);
    expect(dragStore.getState().blocked).not.toBeNull();
    // S2 has no other section, so the strip's one action reveals it in the catalog.
    expect(document.activeElement).toHaveAttribute('data-feedback-action');
  });
});
