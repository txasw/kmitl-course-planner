import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { makeSection } from '../../../tests/support/domain-builders';
import { DragCard } from './DragCard';

afterEach(cleanup);

describe('DragCard', () => {
  it('shows the subject id, section, and lecture badge', () => {
    render(
      <DragCard
        section={makeSection({
          subjectId: '90592033',
          section: '901',
          kind: 'lecture',
        })}
      />,
    );
    expect(screen.getByText('90592033')).toBeInTheDocument();
    expect(screen.getByText('901')).toBeInTheDocument();
    expect(screen.getByText('ทฤษฎี')).toBeInTheDocument();
  });

  it('shows the practice badge for a practice section', () => {
    render(<DragCard section={makeSection({ kind: 'practice' })} />);
    expect(screen.getByText('ปฏิบัติ')).toBeInTheDocument();
  });
});
