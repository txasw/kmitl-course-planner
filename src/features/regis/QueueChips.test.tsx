import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import { QueueChips } from './QueueChips';

// A chip names its subject in a tooltip on a fine pointer, and shows none on a touch
// screen, where a tap would leave it up over the next chips.

const t = createTranslator('th');
// Test only: a chip reads the row's id and names alone.
const ROW = {
  subjectId: '90000003',
  nameTh: 'วิชาซี',
  nameEn: 'Subject C',
} as unknown as ChecklistRow;

afterEach(cleanup);

function renderChips(coarse: boolean) {
  render(
    <QueueChips
      rows={[ROW]}
      statuses={{}}
      currentId={ROW.subjectId}
      stale={false}
      coarse={coarse}
      locale="th"
      t={t}
      onPick={() => undefined}
    />,
  );
  return screen.getByRole('button', { name: /^90000003 วิชาซี/ });
}

describe('QueueChips tooltip', () => {
  it('names the subject in a tooltip on a fine pointer', () => {
    fireEvent.focus(renderChips(false));
    expect(screen.getByRole('tooltip')).toHaveTextContent('วิชาซี');
  });

  it('shows no tooltip on a touch screen', () => {
    const chip = renderChips(true);
    fireEvent.focus(chip);
    fireEvent.click(chip);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
