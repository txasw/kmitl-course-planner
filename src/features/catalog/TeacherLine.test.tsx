import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { createTranslator } from '@/lib/i18n/t';
import { TeacherLine } from './TeacherLine';

const th = createTranslator('th');
const en = createTranslator('en');

// jsdom has no layout, so the shared line observer never reports. This stub records
// the report callback so a test can fire it after giving the line a clipped width. It
// is installed before the first render, which creates the shared observer.
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
  observe(): void {
    return undefined;
  }
  unobserve(): void {
    return undefined;
  }
  disconnect(): void {
    return undefined;
  }
}
globalThis.ResizeObserver = RecordingObserver;

function reportClipped(node: HTMLElement): void {
  // The two line clamp hides the rest below its box, so the scroll height passes it.
  Object.defineProperty(node, 'scrollHeight', { value: 80 });
  Object.defineProperty(node, 'clientHeight', { value: 32 });
  act(() => {
    report?.(node);
  });
}

const TEACHERS = ['อ. หนึ่ง', 'อ. สอง', 'อ. สาม'];
const JOINED = 'อ. หนึ่ง, อ. สอง, อ. สาม';

afterEach(cleanup);

describe('TeacherLine', () => {
  it('renders nothing for a section with no teachers', () => {
    const { container } = render(<TeacherLine teachers={[]} t={th} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers no control while the list fits in two lines', () => {
    render(<TeacherLine teachers={TEACHERS} t={th} />);
    expect(screen.getByText('ผู้สอน')).toBeInTheDocument();
    expect(screen.getByText(JOINED)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a labelled expand control when the line clips and wraps the list', () => {
    render(<TeacherLine teachers={TEACHERS} t={th} />);
    const line = screen.getByText(JOINED);
    reportClipped(line);

    const toggle = screen.getByRole('button', { name: 'ดูผู้สอนทั้งหมด' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(line.className.split(' ')).toContain('line-clamp-2');

    fireEvent.click(toggle);
    const collapse = screen.getByRole('button', { name: 'ย่อรายชื่อผู้สอน' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(
      collapse.getAttribute('aria-controls') ?? '',
    );
    expect(list?.textContent).toBe(JOINED);
    expect(screen.getByText(JOINED).className.split(' ')).toContain(
      'break-words',
    );
  });

  it('names the control in English', () => {
    render(<TeacherLine teachers={TEACHERS} t={en} />);
    reportClipped(screen.getByText(JOINED));
    expect(
      screen.getByRole('button', { name: 'Show all teachers' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Teachers')).toBeInTheDocument();
  });
});
