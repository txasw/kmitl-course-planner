import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { Term } from '@/lib/routing/academicTerms';
import { makePlan } from '../../../tests/support/domain-builders';
import { planStore } from './planStore';
import { switchOrCreatePlanForTerm } from './switchPlanTerm';
import { TermSwitchLabel } from './TermSwitchLabel';

const TERM_S2: Term = { year: '2569', semester: '2' };
const t = createTranslator('th');

afterEach(() => {
  cleanup();
  planStore.setState({
    plans: [],
    activePlanId: null,
    entries: [],
    pendingUndo: null,
  });
});

describe('TermSwitchLabel', () => {
  it('says create when no plan exists for the term', () => {
    planStore.setState({ plans: [makePlan({ id: 'p1', semester: '1' })] });
    render(<TermSwitchLabel term={TERM_S2} t={t} />);
    expect(screen.getByText('สร้างตารางภาค 2/2569')).toBeInTheDocument();
  });

  it('says open when a plan for the term already exists', () => {
    planStore.setState({
      plans: [
        makePlan({ id: 'p1', semester: '1' }),
        makePlan({ id: 'p2', semester: '2' }),
      ],
    });
    render(<TermSwitchLabel term={TERM_S2} t={t} />);
    expect(screen.getByText('เปิดตารางภาค 2/2569')).toBeInTheDocument();
  });

  it('follows the store once the action creates the plan', () => {
    render(<TermSwitchLabel term={TERM_S2} t={t} />);
    expect(screen.getByText('สร้างตารางภาค 2/2569')).toBeInTheDocument();
    act(() => {
      switchOrCreatePlanForTerm(TERM_S2);
    });
    expect(screen.getByText('เปิดตารางภาค 2/2569')).toBeInTheDocument();
  });
});
