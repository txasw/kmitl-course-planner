import { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  curriculumListSchema,
  departmentListSchema,
  facultyListSchema,
} from '@/lib/domain/schemas';
import { createTranslator } from '@/lib/i18n/t';
import type { ReferenceLists } from '@/lib/reference/filters';
import { defaultCategoryForm, defaultClassForm } from '@/lib/search/formState';
import {
  CategoryFields,
  ClassFields,
  SubjectIdInput,
  TermFields,
} from './fields';
import { CurriculumFields } from './CurriculumFields';

afterEach(cleanup);

// The leading icon a search select draws beside its control, or null when it has none.
function leadingIcon(name: string): SVGElement | null {
  const control = screen.getByRole('combobox', { name });
  return control.parentElement?.querySelector('svg') ?? null;
}

function expectLeadingIcon(name: string, iconClass: string) {
  const icon = leadingIcon(name);
  expect(icon).toHaveClass(iconClass);
  expect(icon).toHaveAttribute('aria-hidden', 'true');
}

// A controlled harness so the input reflects the sanitized value the way it does in the
// search form, which is what a composition end reads back.
function Harness({
  onChange,
  onSubmit,
}: {
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <SubjectIdInput
      label="รหัสวิชา"
      value={value}
      hint="hint"
      invalid={false}
      invalidMessage="invalid"
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      onSubmit={onSubmit}
    />
  );
}

function setup() {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  render(<Harness onChange={onChange} onSubmit={onSubmit} />);
  const input = screen.getByRole('textbox');
  return { onChange, onSubmit, input };
}

describe('SubjectIdInput', () => {
  it('passes only digits to onChange when letters are typed', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '12a3' } });
    expect(onChange).toHaveBeenLastCalledWith('123');
  });

  it('clamps a pasted over long value to eight digits', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '12313213123asdasd' } });
    expect(onChange).toHaveBeenLastCalledWith('12313213');
  });

  it('keeps leading zeros through onChange', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: '01234567' } });
    expect(onChange).toHaveBeenLastCalledWith('01234567');
  });

  it('sanitizes on composition end for an IME commit', () => {
    const { onChange, input } = setup();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '12ก' } });
    // While composing the raw value passes through untouched.
    expect(onChange).toHaveBeenLastCalledWith('12ก');
    fireEvent.compositionEnd(input, { target: { value: '12ก' } });
    expect(onChange).toHaveBeenLastCalledWith('12');
  });

  it('shows a live digit count out of eight', () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '123' } });
    expect(screen.getByText('3/8')).toBeInTheDocument();
  });

  it('routes an Enter press to onSubmit', () => {
    const { onSubmit, input } = setup();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('TermFields', () => {
  const t = createTranslator('en');

  it('lists academic years newest first', () => {
    render(
      <TermFields
        term={{ year: '', semester: '1' }}
        years={['2560', '2561', '2562']}
        t={t}
        onChange={() => undefined}
      />,
    );
    fireEvent.focus(screen.getByRole('combobox', { name: t('search.year') }));
    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['2562', '2561', '2560']);
  });

  it('groups the year and semester under one term label', () => {
    render(
      <TermFields
        term={{ year: '2569', semester: '2' }}
        years={['2569']}
        t={t}
        onChange={() => undefined}
      />,
    );
    const group = screen.getByRole('group', { name: t('search.termGroup') });
    expect(group).toContainElement(
      screen.getByRole('combobox', { name: t('search.year') }),
    );
    expect(group).toContainElement(
      screen.getByRole('combobox', { name: t('search.semester') }),
    );
  });

  it('reports a semester pick as a term patch', () => {
    const onChange = vi.fn();
    render(
      <TermFields
        term={{ year: '2569', semester: '1' }}
        years={['2569']}
        t={t}
        onChange={onChange}
      />,
    );
    fireEvent.focus(
      screen.getByRole('combobox', { name: t('search.semester') }),
    );
    fireEvent.mouseDown(screen.getByRole('option', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith({ semester: '3' });
  });
});

describe('tab fields', () => {
  const t = createTranslator('en');
  const reference: ReferenceLists = {
    faculties: { status: 'idle' },
    departments: { status: 'idle' },
    curricula: { status: 'idle' },
    subjectOwners: { status: 'idle' },
  };

  it('leave the term out of the class tab fields', () => {
    render(
      <ClassFields
        form={defaultClassForm()}
        reference={reference}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expect(
      screen.queryByRole('combobox', { name: t('search.year') }),
    ).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: t('search.semester') }),
    ).toBeNull();
    expect(
      screen.getByRole('combobox', { name: t('search.faculty') }),
    ).toBeInTheDocument();
  });

  it('leave the term out of the category tab fields', () => {
    render(
      <CategoryFields
        form={defaultCategoryForm()}
        reference={reference}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expect(
      screen.queryByRole('combobox', { name: t('search.year') }),
    ).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: t('search.semester') }),
    ).toBeNull();
  });
});

describe('CurriculumFields', () => {
  const t = createTranslator('en');
  const loaded: ReferenceLists = {
    faculties: {
      status: 'ready',
      data: facultyListSchema.parse(loadFixture('faculty.capture.json')),
    },
    departments: {
      status: 'ready',
      data: departmentListSchema.parse(loadFixture('department.capture.json')),
    },
    curricula: {
      status: 'ready',
      data: curriculumListSchema.parse(
        loadFixture('curriculum.level1.capture.json'),
      ),
    },
    subjectOwners: { status: 'idle' },
  };
  const selection = {
    faculty: '01',
    department: '05',
    curriculum: '137',
    classYear: '1',
  } as const;

  function optionNames(name: string): (string | null)[] {
    fireEvent.focus(screen.getByRole('combobox', { name }));
    return screen.getAllByRole('option').map((option) => option.textContent);
  }

  it('offers the all options when a search renders them', () => {
    render(
      <CurriculumFields
        value={selection}
        includeAll
        reference={loaded}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expect(optionNames(t('search.curriculum'))).toContain(
      t('search.curriculumAll'),
    );
    cleanup();
    render(
      <CurriculumFields
        value={selection}
        includeAll
        reference={loaded}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expect(optionNames(t('search.classYear'))).toContain(
      t('search.classYearAll'),
    );
  });

  it('leaves out every all option and the term without them', () => {
    render(
      <CurriculumFields
        value={selection}
        includeAll={false}
        reference={loaded}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expect(
      screen.queryByRole('combobox', { name: t('search.year') }),
    ).toBeNull();
    const curricula = optionNames(t('search.curriculum'));
    expect(curricula).not.toContain(t('search.curriculumAll'));
    expect(curricula.length).toBeGreaterThan(0);
    cleanup();
    render(
      <CurriculumFields
        value={selection}
        includeAll={false}
        reference={loaded}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expect(optionNames(t('search.classYear'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
  });

  it('clears the department and curriculum when the faculty changes', () => {
    const patch = vi.fn();
    render(
      <CurriculumFields
        value={selection}
        includeAll={false}
        reference={loaded}
        locale="en"
        t={t}
        patch={patch}
      />,
    );
    fireEvent.focus(
      screen.getByRole('combobox', { name: t('search.faculty') }),
    );
    const [first] = screen.getAllByRole('option');
    if (first === undefined) {
      throw new Error('expected a faculty option');
    }
    fireEvent.mouseDown(first);
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ department: '', curriculum: '' }),
    );
  });
});

describe('select icons', () => {
  const t = createTranslator('en');
  const reference: ReferenceLists = {
    faculties: { status: 'idle' },
    departments: { status: 'idle' },
    curricula: { status: 'idle' },
    subjectOwners: { status: 'idle' },
  };

  it('marks the year and semester with a calendar and a hash', () => {
    render(
      <TermFields
        term={{ year: '2569', semester: '1' }}
        years={['2569']}
        t={t}
        onChange={() => undefined}
      />,
    );
    expectLeadingIcon(t('search.year'), 'lucide-calendar-days');
    expectLeadingIcon(t('search.semester'), 'lucide-hash');
  });

  it('marks the faculty and the category on the category tab', () => {
    render(
      <CategoryFields
        form={defaultCategoryForm()}
        reference={reference}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expectLeadingIcon(t('search.faculty'), 'lucide-building-2');
    expectLeadingIcon(t('search.subjectOwner'), 'lucide-layout-grid');
  });

  it('marks the curriculum and leaves the department and class year plain', () => {
    render(
      <ClassFields
        form={defaultClassForm()}
        reference={reference}
        locale="en"
        t={t}
        patch={() => undefined}
      />,
    );
    expectLeadingIcon(t('search.faculty'), 'lucide-building-2');
    expectLeadingIcon(t('search.curriculum'), 'lucide-graduation-cap');
    expect(leadingIcon(t('search.department'))).toBeNull();
    expect(leadingIcon(t('search.classYear'))).toBeNull();
  });
});
