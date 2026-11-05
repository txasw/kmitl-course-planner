import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { normalizeTeachTable } from '@/lib/domain/normalize';
import type { Section } from '@/lib/domain/types';
import { loadFixture } from '../../../tests/support/fixtures';
import { RulesNotice } from './RulesNotice';

const th = createTranslator('th');
const en = createTranslator('en');

// jsdom has no layout, so the shared line observer never reports. This stub records
// the observed lines so a test can fire the report after giving a line a clipped
// width. It is installed before the first render, which creates the shared observer.
const observed = new Set<Element>();
let report: ((target: Element) => void) | null = null;
class RecordingObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    report = (target) => {
      callback(
        [
          {
            target,
            contentRect: new DOMRectReadOnly(),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    };
  }
  observe(target: Element): void {
    observed.add(target);
  }
  unobserve(target: Element): void {
    observed.delete(target);
  }
  disconnect(): void {
    observed.clear();
  }
}
globalThis.ResizeObserver = RecordingObserver;

function reportClipped(node: HTMLElement): void {
  Object.defineProperty(node, 'scrollWidth', { value: 400 });
  Object.defineProperty(node, 'clientWidth', { value: 120 });
  act(() => {
    report?.(node);
  });
}

// 96642011/101 in the exam capture is limited to the faculty and to a dual degree
// international curriculum, written with angle bracket qualifiers in both languages.
function dualDegreeSection(): Section {
  const result = normalizeTeachTable(
    loadFixture('teach-table.with-exams.capture.json'),
  );
  if (!result.ok) {
    throw new Error('fixture failed to normalize');
  }
  const section = result.value.courses
    .find((course) => course.subjectId === '96642011')
    ?.sections.find((candidate) => candidate.section === '101');
  if (section === undefined) {
    throw new Error('fixture is missing the dual degree section');
  }
  return section;
}

afterEach(cleanup);

describe('RulesNotice', () => {
  it('renders nothing when the section has no conditions', () => {
    const { container } = render(
      <RulesNotice rulesTh="" rulesEn="" locale="th" t={th} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('rests on the first rule with a control that counts every rule', () => {
    const section = dualDegreeSection();
    render(
      <RulesNotice
        rulesTh={section.rulesTh}
        rulesEn={section.rulesEn}
        locale="th"
        t={th}
      />,
    );
    expect(screen.getByText('เงื่อนไข')).toBeInTheDocument();
    expect(screen.getByText('เฉพาะคณะวิศวกรรมศาสตร์')).toBeInTheDocument();
    expect(screen.queryByText(/<สองปริญญา>/)).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', {
      name: 'ดูเงื่อนไขทั้งหมด (3)',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.className.split(' ')).toContain('min-h-6');
  });

  it('reads in the warn tone with no box fill', () => {
    const { container } = render(
      <RulesNotice rulesTh="เฉพาะคณะ" rulesEn="" locale="th" t={th} />,
    );
    const tokens = container.firstElementChild?.className.split(' ') ?? [];
    expect(tokens).toContain('text-warn');
    expect(tokens.some((token) => token.startsWith('bg-'))).toBe(false);
  });

  it('lists every rule with its qualifiers as text once expanded', () => {
    const section = dualDegreeSection();
    render(
      <RulesNotice
        rulesTh={section.rulesTh}
        rulesEn={section.rulesEn}
        locale="th"
        t={th}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'ดูเงื่อนไขทั้งหมด (3)' }),
    );
    const toggle = screen.getByRole('button', { name: 'ซ่อนเงื่อนไข' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list');
    expect(toggle).toHaveAttribute('aria-controls', list.id);
    expect(list).toHaveAttribute('lang', 'th');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.getAllByText(/<สองปริญญา><หลักสูตรนานาชาติ>/).length,
    ).toBeGreaterThan(0);
  });

  it('reads the English rules with their language in the English locale', () => {
    const section = dualDegreeSection();
    render(
      <RulesNotice
        rulesTh={section.rulesTh}
        rulesEn={section.rulesEn}
        locale="en"
        t={en}
      />,
    );
    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Only School of Engineering')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show all conditions (3)' }),
    ).toBeInTheDocument();
  });

  it('falls back to the other language and marks it', () => {
    render(
      <RulesNotice
        rulesTh="เฉพาะนักศึกษาชั้นปี 1"
        rulesEn=""
        locale="en"
        t={en}
      />,
    );
    expect(screen.getByRole('list')).toHaveAttribute('lang', 'th');
    expect(screen.getByText('เฉพาะนักศึกษาชั้นปี 1')).toBeInTheDocument();
  });

  it('offers no control for a single rule that fits its line', () => {
    render(<RulesNotice rulesTh="เฉพาะคณะ" rulesEn="" locale="th" t={th} />);
    expect(screen.getByText('เฉพาะคณะ').className).toContain('truncate');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers the control once a single rule clips its line', () => {
    render(
      <RulesNotice
        rulesTh="เฉพาะสาขาวิศวกรรมคอมพิวเตอร์ (ไม่รับนักศึกษาอื่น)"
        rulesEn=""
        locale="th"
        t={th}
      />,
    );
    const line = screen.getByText(
      'เฉพาะสาขาวิศวกรรมคอมพิวเตอร์ (ไม่รับนักศึกษาอื่น)',
    );
    expect(observed.has(line)).toBe(true);
    reportClipped(line);
    fireEvent.click(
      screen.getByRole('button', { name: 'ดูเงื่อนไขทั้งหมด (1)' }),
    );
    expect(
      screen.getByText('เฉพาะสาขาวิศวกรรมคอมพิวเตอร์ (ไม่รับนักศึกษาอื่น)')
        .className,
    ).toContain('break-words');
    expect(
      screen.getByRole('button', { name: 'ซ่อนเงื่อนไข' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
