import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { FocusPills } from './FocusPills';

// The pills under the subject in focus keep their labels short and carry the full
// sentence of a condition or a code under several curricula as a tooltip and description.

const t = createTranslator('en');

function row(patch: Partial<ChecklistRow>): ChecklistRow {
  return {
    subjectId: '01476107',
    nameTh: '',
    nameEn: '',
    credit: 3,
    planned: [],
    alternatives: [],
    state: 'notDone',
    observed: null,
    chosen: null,
    conditionsTh: [],
    conditionsEn: [],
    duplicateCode: null,
    missing: false,
    plannedSeat: null,
    ...patch,
  };
}

function renderPills(
  patch: Partial<ChecklistRow>,
  status: HelperStatus,
  prerequisites: readonly string[] = [],
) {
  return render(
    <FocusPills
      row={row(patch)}
      status={status}
      prerequisites={prerequisites}
      plannedCodes="1"
      locale="en"
      t={t}
    />,
  );
}

afterEach(cleanup);

describe('FocusPills', () => {
  it('carries a condition with no subject id as a tooltip and description', async () => {
    const view = renderPills(
      { conditionsEn: ['For third year students only'] },
      'cond',
    );
    const pill = screen.getByText('Condition').closest('[aria-description]');
    expect(pill).toHaveAttribute(
      'aria-description',
      'Has conditions: For third year students only',
    );
    if (!(pill instanceof HTMLElement)) throw new Error('no pill');
    fireEvent.focus(pill);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Has conditions: For third year students only',
    );
    await expectNoSeriousA11yViolations(view.container);
  });

  it('names the grade a printed prerequisite waits for', () => {
    renderPills({ conditionsTh: ['ต้องสอบผ่าน 01476105'] }, 'cond');
    expect(screen.getByText('Awaits grade 01476105')).toBeInTheDocument();
    expect(screen.queryByText('Condition')).toBeNull();
  });

  it('prefers the ids the page named over the printed ones', () => {
    renderPills({ conditionsTh: ['ต้องสอบผ่าน 01476105'] }, 'cond', ['90641001']);
    expect(screen.getByText('Awaits grade 90641001')).toBeInTheDocument();
  });

  it('explains a planned code under several curricula', () => {
    renderPills({ duplicateCode: '901' }, 'todo');
    const pill = screen
      .getByText('Several curricula')
      .closest('[aria-description]');
    expect(pill?.getAttribute('aria-description')).toBe(
      'Section 901 is offered under more than one curriculum. Choose the one for your curriculum on the registration page.',
    );
  });
});
