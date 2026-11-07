import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { loadFixture } from '../../../tests/support/fixtures';
import { teachTableResult } from '../../../tests/support/searchDeps';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import {
  currentTermSchema,
  curriculumListSchema,
  departmentListSchema,
  facultyListSchema,
  subjectOwnerListSchema,
} from '@/lib/domain/schemas';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { RequestMessage } from '@/lib/messaging/protocol';
import type { TypedSend } from '@/lib/messaging/sendTyped';
import { ok } from '@/lib/utils/result';
import {
  defaultCategoryForm,
  defaultClassForm,
  defaultSubjectIdForm,
} from '@/lib/search/formState';
import { CatalogPanel } from '@/features/catalog/CatalogPanel';
import { SearchForm } from './SearchForm';
import { searchStore } from './searchStore';
import { SearchDepsProvider, type SearchDeps } from './SearchDepsContext';

const faculties = facultyListSchema.parse(loadFixture('faculty.capture.json'));
const departments = departmentListSchema.parse(
  loadFixture('department.capture.json'),
);
const curricula = curriculumListSchema.parse(
  loadFixture('curriculum.level1.capture.json'),
);
const subjectOwners = subjectOwnerListSchema.parse(
  loadFixture('subject-owner.capture.json'),
);
const currentTerm = currentTermSchema.parse(
  loadFixture('year-semester-now.capture.json'),
);

function ownerCatalog(): NormalizedCatalog {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_subject_owner_id-32.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  return result.value;
}

// A resolving send backed by the captures, whose current term can be held back so
// the fallback stays pending. The cast is required because a single arrow cannot
// satisfy the generic send signature.
function resolvingSend(
  catalog: NormalizedCatalog,
  answerTerm = true,
): TypedSend {
  const handler = (message: RequestMessage) => {
    switch (message.type) {
      case 'ref/faculty':
        return Promise.resolve(ok(faculties));
      case 'ref/department':
        return Promise.resolve(ok(departments));
      case 'ref/curriculum':
        return Promise.resolve(ok(curricula));
      case 'ref/subjectOwner':
        return Promise.resolve(ok(subjectOwners));
      case 'ref/currentTerm':
        return answerTerm
          ? Promise.resolve(ok(currentTerm))
          : new Promise<never>(() => undefined);
      case 'teachTable/query':
        return Promise.resolve(ok(teachTableResult(catalog)));
      default:
        return Promise.resolve(ok(null));
    }
  };
  return handler as unknown as TypedSend;
}

function deps(catalog: NormalizedCatalog = ownerCatalog()): SearchDeps {
  return {
    send: resolvingSend(catalog),
    repo: { load: () => Promise.resolve(null), save: () => Promise.resolve() },
  };
}

function renderSearch(searchDeps: SearchDeps) {
  return render(
    <SearchDepsProvider value={searchDeps}>
      <SearchForm />
      <CatalogPanel />
    </SearchDepsProvider>,
  );
}

beforeEach(() => {
  const term = { year: '2569', semester: '1' } as const;
  const state = searchStore.getState();
  state.hydrate({
    schemaVersion: 2,
    activeTab: 'by_class',
    term,
    byClass: defaultClassForm(),
    bySubjectId: defaultSubjectIdForm(),
    byCategory: defaultCategoryForm(),
  });
  state.setFaculties({ status: 'idle' });
  state.setDepartments({ status: 'idle' });
  state.setCurricula({ status: 'idle' });
  state.setSubjectOwners({ status: 'idle' });
  state.setResult({ status: 'idle' }, null);
  state.setInitialized(false);
});

afterEach(cleanup);

// Drive a searchable combobox: open it, filter, and confirm with Enter.
function selectCombobox(name: string, filter: string) {
  const combo = screen.getByRole('combobox', { name });
  fireEvent.focus(combo);
  fireEvent.change(combo, { target: { value: filter } });
  fireEvent.keyDown(combo, { key: 'Enter' });
}

async function waitEnabled(name: string) {
  const combo = screen.getByRole('combobox', { name });
  await waitFor(() => {
    expect(combo).toBeEnabled();
  });
  return combo;
}

describe('SearchForm', () => {
  it('populates the faculty combobox from reference data', async () => {
    renderSearch(deps());
    const faculty = await waitEnabled('คณะ');
    fireEvent.focus(faculty);
    expect(
      await screen.findByRole('option', { name: /วิศวกรรมศาสตร์/ }),
    ).toBeInTheDocument();
  });

  it('enables the department combobox after a faculty is chosen', async () => {
    renderSearch(deps());
    await waitEnabled('คณะ');
    const department = screen.getByRole('combobox', { name: 'ภาควิชา' });
    expect(department).toBeDisabled();
    selectCombobox('คณะ', '01');
    await waitFor(() => {
      expect(department).toBeEnabled();
    });
    fireEvent.focus(department);
    expect(
      await screen.findByRole('option', { name: /วิศวกรรมโทรคมนาคม/ }),
    ).toBeInTheDocument();
  });

  it('renders the search modes as a tablist that labels its panel', () => {
    renderSearch(deps());
    const tablist = screen.getByRole('tablist', { name: 'ค้นหารายวิชา' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'หลักสูตร',
      'รหัสวิชา',
      'หมวดวิชา',
    ]);
    const selected = screen.getByRole('tab', { name: 'หลักสูตร' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'รหัสวิชา' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
    expect(
      screen.getByRole('tabpanel', { name: 'หลักสูตร' }),
    ).toBeInTheDocument();
  });

  it('moves and selects tabs with the arrow, Home, and End keys', () => {
    renderSearch(deps());
    const byClass = screen.getByRole('tab', { name: 'หลักสูตร' });
    byClass.focus();
    fireEvent.keyDown(byClass, { key: 'ArrowRight' });
    const bySubjectId = screen.getByRole('tab', { name: 'รหัสวิชา' });
    expect(bySubjectId).toHaveFocus();
    expect(bySubjectId).toHaveAttribute('aria-selected', 'true');
    expect(searchStore.getState().activeTab).toBe('by_subject_id');
    expect(
      screen.getByRole('textbox', { name: 'รหัสวิชา' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(bySubjectId, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'หมวดวิชา' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'หมวดวิชา' }), {
      key: 'ArrowRight',
    });
    expect(byClass).toHaveFocus();
    fireEvent.keyDown(byClass, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'หมวดวิชา' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'หมวดวิชา' }), {
      key: 'Home',
    });
    expect(byClass).toHaveFocus();
    expect(searchStore.getState().activeTab).toBe('by_class');
  });

  it('shows a validation message for an out of range persisted subject id', () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'รหัสวิชา' }));
    // Typing can no longer produce an out of range value, since the input sanitizes
    // and clamps to eight digits, so the safety net message is exercised through a
    // persisted over length value that bypasses the input.
    act(() => {
      searchStore.getState().patchSubjectIdForm({ subjectId: '123456789' });
    });
    expect(
      screen.getByText('กรอกรหัสวิชาเป็นตัวเลข 8 หลัก'),
    ).toBeInTheDocument();
  });

  it('messages and focuses the field when an incomplete subject id is submitted', () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'รหัสวิชา' }));
    act(() => {
      searchStore.getState().patchSubjectIdForm({ subjectId: '123' });
    });
    const field = screen.getByRole('textbox', { name: 'รหัสวิชา' });
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    // The button stays enabled for an incomplete id so the click routes to the
    // message rather than being an inert disabled control.
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(
      screen.getByText('กรอกรหัสวิชาเป็นตัวเลข 8 หลัก'),
    ).toBeInTheDocument();
    expect(field).toHaveFocus();
  });

  it('blocks submit and names the missing field until the category form is ready', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'หมวดวิชา' }));
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    // aria-disabled keeps the blocked submit in the tab order, so its reason is read
    // on focus rather than skipped with the control.
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(submit).toHaveAccessibleDescription('เลือกคณะก่อนค้นหา');
    expect(submit).not.toHaveClass('bg-primary-strong');
    fireEvent.click(submit);
    expect(searchStore.getState().barQuery).toBeNull();

    await waitEnabled('คณะ');
    selectCombobox('คณะ', '01');
    await waitFor(() => {
      expect(submit).toHaveAccessibleDescription('เลือกหมวดวิชาก่อนค้นหา');
    });
    await waitEnabled('หมวดวิชา');
    selectCombobox('หมวดวิชา', '90592xxx');
    await waitFor(() => {
      expect(submit).not.toHaveAttribute('aria-disabled');
    });
    expect(submit).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('เลือกหมวดวิชาก่อนค้นหา')).toBeNull();
  });

  it('names the department and then the curriculum on the curriculum tab', async () => {
    renderSearch(deps());
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    expect(submit).toHaveAccessibleDescription('เลือกคณะก่อนค้นหา');
    await waitEnabled('คณะ');
    selectCombobox('คณะ', '01');
    await waitFor(() => {
      expect(submit).toHaveAccessibleDescription('เลือกภาควิชาก่อนค้นหา');
    });
    await waitEnabled('ภาควิชา');
    selectCombobox('ภาควิชา', '08');
    await waitFor(() => {
      expect(submit).toHaveAccessibleDescription('เลือกหลักสูตรก่อนค้นหา');
    });
  });

  it('holds submit with a reason while a query is in flight', () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'รหัสวิชา' }));
    act(() => {
      searchStore.getState().patchSubjectIdForm({ subjectId: '90592033' });
      searchStore.getState().setResult({ status: 'loading' }, null);
    });
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(submit).toHaveAccessibleDescription(
      'รอผลการค้นหาปัจจุบันก่อนค้นหาใหม่',
    );
    fireEvent.click(submit);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'รหัสวิชา' }), {
      key: 'Enter',
    });
    expect(searchStore.getState().barQuery).toBeNull();
    expect(searchStore.getState().result.status).toBe('loading');

    act(() => {
      searchStore.getState().setResult({ status: 'idle' }, null);
    });
    expect(submit).not.toHaveAttribute('aria-disabled');
  });

  it('places the full width submit directly under the last field', () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'หมวดวิชา' }));
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    // The submit block follows the last field, with only the clear action after it.
    const block = submit.parentElement?.parentElement;
    expect(block?.previousElementSibling).toContainElement(
      screen.getByRole('combobox', { name: 'หมวดวิชา' }),
    );
    expect(block?.nextElementSibling).toBe(
      screen.getByRole('button', { name: 'ล้างการค้นหา' }),
    );
    // Alone in its row, the submit takes the full width.
    expect(submit.parentElement?.children).toHaveLength(1);
    expect(submit).toHaveClass('flex-1');
  });

  it('runs a category search and renders the results', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'หมวดวิชา' }));
    await waitEnabled('คณะ');
    selectCombobox('คณะ', '01');
    await waitEnabled('หมวดวิชา');
    selectCombobox('หมวดวิชา', '90592xxx');
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    expect(await screen.findByText('90592033')).toBeInTheDocument();
  });

  it('renders the term once above the tabs and keeps it across a tab switch', async () => {
    renderSearch(deps());
    const semester = screen.getByRole('combobox', { name: 'ภาคการศึกษา' });
    // Wait for the default term to settle so the pick is not replaced by it.
    await waitFor(() => {
      expect(semester).toHaveValue('2');
    });
    const termRow = screen.getByRole('group', { name: 'ปีและภาคการศึกษา' });
    const tabs = screen.getByRole('tab', { name: 'รหัสวิชา' });
    expect(
      termRow.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    selectCombobox('ภาคการศึกษา', '3');
    fireEvent.click(tabs);
    expect(
      screen.getAllByRole('combobox', { name: 'ภาคการศึกษา' }),
    ).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'ภาคการศึกษา' })).toHaveValue(
      '3',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'หมวดวิชา' }));
    expect(searchStore.getState().term).toEqual({
      year: '2569',
      semester: '3',
    });
  });

  it('marks the term pending until the registrar answers', async () => {
    const { container } = renderSearch({
      ...deps(),
      send: resolvingSend(ownerCatalog(), false),
    });
    const form = container.querySelector('[data-term-state]');
    await waitFor(() => {
      expect(form).toHaveAttribute('data-term-state', 'pending');
    });
    cleanup();
    act(() => {
      searchStore.getState().setInitialized(false);
    });
    const settled = renderSearch(deps()).container;
    await waitFor(() => {
      expect(settled.querySelector('[data-term-state]')).toHaveAttribute(
        'data-term-state',
        'settled',
      );
    });
    expect(screen.getByRole('combobox', { name: 'ภาคการศึกษา' })).toHaveValue(
      '2',
    );
  });

  it('clears the fields but keeps the running search and its result', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('tab', { name: 'หมวดวิชา' }));
    await waitEnabled('คณะ');
    selectCombobox('คณะ', '01');
    await waitEnabled('หมวดวิชา');
    selectCombobox('หมวดวิชา', '90592xxx');
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    expect(await screen.findByText('90592033')).toBeInTheDocument();
    const { barQuery, term } = searchStore.getState();

    const clear = screen.getByRole('button', { name: 'ล้างการค้นหา' });
    fireEvent.click(clear);
    const state = searchStore.getState();
    expect(state.byCategory).toEqual({ faculty: '', subjectOwner: '' });
    expect(state.term).toEqual(term);
    expect(state.barQuery).toBe(barQuery);
    expect(state.result.status).toBe('ready');
    expect(screen.getByText('90592033')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ค้นหา' }),
    ).toHaveAccessibleDescription('เลือกคณะก่อนค้นหา');
    expect(clear).toBeInTheDocument();
  });
});
