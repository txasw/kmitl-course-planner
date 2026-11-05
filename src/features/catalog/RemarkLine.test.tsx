import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { RemarkLine } from './RemarkLine';

const th = createTranslator('th');
const en = createTranslator('en');

afterEach(cleanup);

describe('RemarkLine', () => {
  it('renders nothing for an empty remark', () => {
    const { container } = render(<RemarkLine remark="" t={th} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the first line inline under the remark label', () => {
    render(<RemarkLine remark="รับเฉพาะนักศึกษาเก็บตกเท่านั้น" t={th} />);
    expect(screen.getByText('หมายเหตุ')).toBeInTheDocument();
    expect(
      screen.getByText('รับเฉพาะนักศึกษาเก็บตกเท่านั้น'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the remark in the neutral tone, not the conditions warn tone', () => {
    const { container } = render(
      <RemarkLine remark="เปิดสอนร่วมกับคณะอื่น" t={th} />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain('text-ink-soft');
    expect(root?.className).not.toContain('text-warn');
  });

  it('reveals the remaining lines behind a labelled control', () => {
    render(
      <RemarkLine
        remark={
          '1st years: Enroll now\nOther year students can enroll on 2 July 2026'
        }
        t={en}
      />,
    );
    expect(
      screen.queryByText('Other year students can enroll on 2 July 2026'),
    ).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show full remark' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(
      screen.getByText('Other year students can enroll on 2 July 2026'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide remark' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
