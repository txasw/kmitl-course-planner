import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
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
});

afterEach(cleanup);

describe('SearchForm', () => {
  it('populates the faculty select from reference data', async () => {
    renderSearch(deps());
    expect(
      await screen.findByRole('option', { name: /วิศวกรรมศาสตร์/ }),
    ).toBeInTheDocument();
  });

  it('enables the department select after a faculty is chosen', async () => {
    renderSearch(deps());
    const faculty = await screen.findByRole('combobox', { name: 'คณะ' });
    const department = screen.getByRole('combobox', { name: 'ภาควิชา' });
    expect(department).toBeDisabled();
    fireEvent.change(faculty, { target: { value: '01' } });
    await waitFor(() => {
      expect(department).not.toBeDisabled();
    });
    expect(
      screen.getByRole('option', { name: /วิศวกรรมโทรคมนาคม/ }),
    ).toBeInTheDocument();
  });

  it('shows a validation message for an invalid subject id', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('button', { name: 'รหัสวิชา' }));
    const input = await screen.findByRole('textbox', { name: 'รหัสวิชา' });
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(
      screen.getByText('กรอกรหัสวิชาเป็นตัวเลข 1 ถึง 8 หลัก'),
    ).toBeInTheDocument();
  });

  it('keeps submit disabled until the category form is ready', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('button', { name: 'หมวดวิชา' }));
    const submit = screen.getByRole('button', { name: 'ค้นหา' });
    expect(submit).toBeDisabled();
    const faculty = await screen.findByRole('combobox', { name: 'คณะ' });
    fireEvent.change(faculty, { target: { value: '01' } });
    const owner = await screen.findByRole('combobox', { name: 'หมวดวิชา' });
    fireEvent.change(owner, { target: { value: '32' } });
    await waitFor(() => {
      expect(submit).not.toBeDisabled();
    });
  });

  it('runs a category search and renders the results', async () => {
    renderSearch(deps());
    fireEvent.click(screen.getByRole('button', { name: 'หมวดวิชา' }));
    const faculty = await screen.findByRole('combobox', { name: 'คณะ' });
    fireEvent.change(faculty, { target: { value: '01' } });
    const owner = await screen.findByRole('combobox', { name: 'หมวดวิชา' });
    fireEvent.change(owner, { target: { value: '32' } });
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));
    expect(await screen.findByText('90592033')).toBeInTheDocument();
  });
});
