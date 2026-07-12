import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import { loadFixture } from '../../../tests/support/fixtures';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import {
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

function ownerCatalog(): NormalizedCatalog {
  const result = normalizeTeachTable(
    loadFixture('teach-table.by_subject_owner_id-32.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  return result.value;
}

// A resolving send backed by the captures. The cast is required because a single
// arrow cannot satisfy the generic send signature.
function resolvingSend(catalog: NormalizedCatalog): TypedSend {
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
      case 'teachTable/query':
        return Promise.resolve(ok(catalog));
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
    schemaVersion: 1,
    activeTab: 'by_class',
    byClass: defaultClassForm(term),
    bySubjectId: defaultSubjectIdForm(term),
    byCategory: defaultCategoryForm(term),
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

  it('shows a validation message for an invalid persisted subject id', () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('button', { name: 'รหัสวิชา' }));
    // Typing can no longer produce an invalid value, since the input sanitizes to
    // digits, so the safety net message is exercised through a persisted out of range
    // value that bypasses the input.
    act(() => {
      searchStore.getState().patchSubjectIdForm({ subjectId: '123456789' });
    });
    expect(
      screen.getByText('กรอกรหัสวิชาเป็นตัวเลข 1 ถึง 8 หลัก'),
    ).toBeInTheDocument();
  });

  it('keeps submit disabled until the category form is ready', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('button', { name: 'หมวดวิชา' }));
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    expect(submit).toBeDisabled();
    await waitEnabled('คณะ');
    selectCombobox('คณะ', '01');
    await waitEnabled('หมวดวิชา');
    selectCombobox('หมวดวิชา', '90592xxx');
    await waitFor(() => {
      expect(submit).toBeEnabled();
    });
  });

  it('runs a category search and renders the results', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('button', { name: 'หมวดวิชา' }));
    await waitEnabled('คณะ');
    selectCombobox('คณะ', '01');
    await waitEnabled('หมวดวิชา');
    selectCombobox('หมวดวิชา', '90592xxx');
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    expect(await screen.findByText('90592033')).toBeInTheDocument();
  });
});
