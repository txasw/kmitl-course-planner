import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  waitFor,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { toSnapshot } from '@/lib/planner/transaction';
import {
  makeCourse,
  makeSection,
} from '../../../tests/support/domain-builders';
import { expectNoSeriousA11yViolations } from '../../../tests/support/axe';
import { SectionListbox, type SectionOption } from './SectionListbox';

// The section menu of the helper card is a select only combobox: focus stays on the
// trigger, which names the active option, the keys move through the options, and a
// closed group can be reached but not chosen. It is never a native select.

const t = createTranslator('th');
const COURSE = makeCourse({ subjectId: '90000003' });

function option(
  id: string,
  section: string,
  extra: Partial<SectionOption> = {},
) {
  const snapshot = toSnapshot(
    COURSE,
    makeSection({ teachTableId: id, subjectId: '90000003', section }),
  );
  return {
    ids: [id],
    sections: [snapshot],
    fit: 'fits',
    seat: 'open',
    planned: false,
    ...extra,
  } satisfies SectionOption;
}

const OPTIONS = [
  option('T1', '901', { planned: true }),
  option('T2', '902'),
  option('T3', '903', { seat: 'closed' }),
];

function renderMenu(onChoose = vi.fn()) {
  const view = render(
    <SectionListbox
      subjectId="90000003"
      options={OPTIONS}
      chosen={['T1']}
      refused={null}
      hasKit
      onChoose={onChoose}
      align="start"
      t={t}
    >
      {(trigger) => (
        <button {...trigger.props} type="button" aria-label="กลุ่ม 901, เลือกกลุ่ม">
          901
        </button>
      )}
    </SectionListbox>,
  );
  return { view, onChoose, trigger: screen.getByRole('combobox') };
}

afterEach(() => {
  cleanup();
});

describe('SectionListbox', () => {
  it('keeps focus on a combobox trigger that names the active option', async () => {
    const { view, trigger } = renderMenu();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0]?.id);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-activedescendant', options[1]?.id);
    expect(view.container.querySelector('select')).toBeNull();
    await expectNoSeriousA11yViolations(view.container);
  });

  it('chooses the active option with Enter and skips a closed group', () => {
    const { onChoose, trigger } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'End' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChoose).toHaveBeenCalledWith(OPTIONS[1]);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('floats against the viewport, capped to the room on screen', async () => {
    const { trigger } = renderMenu();
    fireEvent.click(trigger);
    const panel = screen.getByRole('listbox').parentElement;
    // A fixed menu escapes the card's scrolling body, and the size middleware caps it.
    expect(panel?.style.position).toBe('fixed');
    await waitFor(() => {
      expect(panel?.style.maxHeight).toMatch(/px$/);
    });
  });
});
