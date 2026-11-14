import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  curriculumListSchema,
  departmentListSchema,
  facultyListSchema,
} from '@/lib/domain/schemas';
import { defaultClassForm } from '@/lib/search/formState';
import { searchStore } from '@/features/search/searchStore';
import { uiStore } from '@/features/shell/uiStore';
import { catalogStore } from './catalogStore';
import { FilterBar } from './FilterBar';

const CREDIT = /หน่วยกิต|Credit/i;
const FILTER_BUTTON = /^(?:ตัวกรอง|Filters)$/;

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().setLanguage('th');
    uiStore.getState().setCurriculumProfile(null);
    searchStore.getState().patchClassForm(defaultClassForm());
  });
});
beforeEach(() => {
  catalogStore.getState().resetFilter();
});

function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: FILTER_BUTTON }));
}

describe('FilterBar', () => {
  it('names the text field by its visible label and keeps the hint as placeholder', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    const field = screen.getByLabelText('กรองรายการ');
    expect(field).toBe(screen.getByRole('searchbox', { name: 'กรองรายการ' }));
    expect(screen.getByText('กรองรายการ').tagName).toBe('LABEL');
    expect(field).toHaveAttribute(
      'placeholder',
      'รหัสวิชา ชื่อวิชา หรืออาจารย์',
    );
    fireEvent.change(field, { target: { value: '9059' } });
    expect(catalogStore.getState().filter.text).toBe('9059');
  });

  it('draws the text field boundary with the form control token', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    const field = screen.getByLabelText('กรองรายการ');
    expect(field).toHaveClass('border-border-strong');
    expect(field).not.toHaveClass('border-border');
  });

  it('renders the credit filter as a select only combobox in the popover', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    const trigger = screen.getByRole('combobox', { name: CREDIT });
    expect(trigger.tagName).toBe('DIV');
    expect(document.querySelector('select')).toBeNull();
  });

  it('selecting a credit option sets the numeric credit', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    fireEvent.click(screen.getByRole('combobox', { name: CREDIT }));
    fireEvent.mouseDown(screen.getByRole('option', { name: '3' }));
    expect(catalogStore.getState().filter.credit).toBe(3);
  });

  it('shows the active facet count on the filter button', () => {
    catalogStore.getState().setHideFull(true);
    catalogStore.getState().toggleDay(1);
    render(<FilterBar creditOptions={[3, 4]} />);
    expect(
      screen.getByRole('button', { name: FILTER_BUTTON }),
    ).toHaveTextContent('2');
  });

  it('removes a facet from its chip', () => {
    catalogStore.getState().setHideFull(true);
    render(<FilterBar creditOptions={[3, 4]} />);
    fireEvent.click(
      screen.getByRole('button', { name: /(นำออก|Remove).+(เต็ม|full)/i }),
    );
    expect(catalogStore.getState().filter.hideFull).toBe(false);
  });

  it('clears every facet from the clear all chip', () => {
    catalogStore.getState().setHideFull(true);
    catalogStore.getState().toggleDay(1);
    render(<FilterBar creditOptions={[3, 4]} />);
    fireEvent.click(screen.getByRole('button', { name: /ล้างตัวกรอง|Clear/i }));
    expect(catalogStore.getState().filter.hideFull).toBe(false);
    expect(catalogStore.getState().filter.days).toHaveLength(0);
  });

  it('renders the hide facets as switches that update the store', () => {
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(4);
    // The three hide switches come first, hide full, hide conflicting, and hide
    // unscheduled in order, then the curriculum switch, so toggling the first sets
    // hideFull.
    const [hideFull] = switches;
    if (hideFull === undefined) {
      throw new Error('expected the hide full switch');
    }
    fireEvent.click(hideFull);
    expect(catalogStore.getState().filter.hideFull).toBe(true);
  });

  it('labels the hide conflicting switch for time and exam clashes alike', () => {
    // The filter hides every conflicting section, exam clashes included, so its label
    // names conflicts in general rather than time conflicts only.
    render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    expect(
      screen.getByRole('switch', { name: 'ซ่อนรายการที่ชนกัน' }),
    ).toBeInTheDocument();
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(
      screen.getByRole('switch', { name: 'Hide conflicts' }),
    ).toBeInTheDocument();
  });

  it('has no serious accessibility violations with the popover open', async () => {
    const { container } = render(<FilterBar creditOptions={[3, 4]} />);
    openFilters();
    await expectNoSeriousA11yViolations(container);
  });

  describe('open to my curriculum', () => {
    const CURRICULUM_SWITCH = 'เฉพาะที่เปิดให้หลักสูตรของฉัน';
    const PROFILE = {
      facultyId: '01',
      departmentId: '05',
      curriculumId: '137',
      classYear: '1',
    };

    beforeEach(() => {
      const store = searchStore.getState();
      store.setFaculties({
        status: 'ready',
        data: facultyListSchema.parse(loadFixture('faculty.capture.json')),
      });
      store.setDepartments({
        status: 'ready',
        data: departmentListSchema.parse(
          loadFixture('department.capture.json'),
        ),
      });
      store.setCurricula({
        status: 'ready',
        data: curriculumListSchema.parse(
          loadFixture('curriculum.level1.capture.json'),
        ),
      });
    });

    function optionTexts(name: string): (string | null)[] {
      fireEvent.focus(screen.getByRole('combobox', { name }));
      return screen.getAllByRole('option').map((option) => option.textContent);
    }

    it('describes the switch with the scope of the current search', () => {
      render(<FilterBar creditOptions={[3]} />);
      openFilters();
      expect(
        screen.getByRole('switch', { name: CURRICULUM_SWITCH }),
      ).toHaveAccessibleDescription('อ้างอิงจากผลการค้นหานี้');
    });

    it('opens the picker on first use with no all options and no term', () => {
      act(() => {
        searchStore.getState().patchClassForm({
          faculty: '01',
          department: '05',
          curriculum: 'all',
          classYear: 'all',
        });
      });
      render(<FilterBar creditOptions={[3]} />);
      openFilters();
      const toggle = screen.getByRole('switch', { name: CURRICULUM_SWITCH });
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(catalogStore.getState().filter.curriculum).toBeNull();
      expect(
        screen.getByRole('group', { name: 'เลือกหลักสูตรของฉัน' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'ปีการศึกษา' })).toBeNull();
      expect(
        screen.queryByRole('combobox', { name: 'ภาคการศึกษา' }),
      ).toBeNull();
      const curricula = optionTexts('หลักสูตร');
      expect(curricula.length).toBeGreaterThan(0);
      expect(curricula).not.toContain('ทุกหลักสูตร');
      expect(optionTexts('ชั้นปี')).not.toContain('ทุกชั้นปี');
    });

    it('prefills the picker from the class search and applies the choice', () => {
      act(() => {
        searchStore.getState().patchClassForm({
          faculty: '01',
          department: '05',
          curriculum: '137',
          classYear: 'all',
        });
      });
      render(<FilterBar creditOptions={[3]} />);
      openFilters();
      fireEvent.click(screen.getByRole('switch', { name: CURRICULUM_SWITCH }));
      const apply = screen.getByRole('button', { name: 'ใช้หลักสูตรนี้' });
      // The class year was all, which a profile cannot hold, so it starts empty.
      expect(apply).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(apply);
      expect(uiStore.getState().curriculumProfile).toBeNull();
      fireEvent.focus(screen.getByRole('combobox', { name: 'ชั้นปี' }));
      fireEvent.mouseDown(screen.getByRole('option', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: 'ใช้หลักสูตรนี้' }));
      expect(uiStore.getState().curriculumProfile).toEqual(PROFILE);
      expect(catalogStore.getState().filter.curriculum).toEqual(PROFILE);
      expect(
        screen.getByRole('switch', { name: CURRICULUM_SWITCH }),
      ).toHaveAttribute('aria-checked', 'true');
      expect(
        screen.queryByRole('group', { name: 'เลือกหลักสูตรของฉัน' }),
      ).toBeNull();
    });

    it('leaves the switch off when the picker is cancelled', () => {
      render(<FilterBar creditOptions={[3]} />);
      openFilters();
      fireEvent.click(screen.getByRole('switch', { name: CURRICULUM_SWITCH }));
      fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
      expect(
        screen.queryByRole('group', { name: 'เลือกหลักสูตรของฉัน' }),
      ).toBeNull();
      expect(catalogStore.getState().filter.curriculum).toBeNull();
      expect(
        screen.getByRole('switch', { name: CURRICULUM_SWITCH }),
      ).toHaveFocus();
    });

    it('filters at once with a saved curriculum and names it', () => {
      act(() => {
        uiStore.getState().setCurriculumProfile(PROFILE);
      });
      render(<FilterBar creditOptions={[3]} />);
      openFilters();
      expect(screen.getByText(/ชั้นปี 1/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('switch', { name: CURRICULUM_SWITCH }));
      expect(catalogStore.getState().filter.curriculum).toEqual(PROFILE);
      expect(
        screen.queryByRole('group', { name: 'เลือกหลักสูตรของฉัน' }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: FILTER_BUTTON }),
      ).toHaveTextContent('1');
    });

    it('removes the curriculum facet from its chip', () => {
      act(() => {
        catalogStore.getState().setCurriculum(PROFILE);
      });
      render(<FilterBar creditOptions={[3]} />);
      fireEvent.click(
        screen.getByRole('button', {
          name: `นำออก ${CURRICULUM_SWITCH}`,
        }),
      );
      expect(catalogStore.getState().filter.curriculum).toBeNull();
    });

    it('has no serious accessibility violations with the picker open', async () => {
      const { container } = render(<FilterBar creditOptions={[3]} />);
      openFilters();
      fireEvent.click(screen.getByRole('switch', { name: CURRICULUM_SWITCH }));
      await expectNoSeriousA11yViolations(container);
    });
  });
});
